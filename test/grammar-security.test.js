/**
 * Grammar/Structures sync security: the Vercel proxy requires a configured
 * secret, sends no wildcard CORS, times out upstream calls and never echoes
 * internal error messages; the Apps Script rejects requests when no secret is
 * configured. No real network: fetch is stubbed, Apps Script runs in a VM.
 * Run: node test/grammar-security.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import proxy from '../api/grammar-sync.js';

function response() {
  return {
    headers: {}, code: 200, body: undefined,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };
}

async function withEnv(env, fetchImpl, run) {
  const saved = { url: process.env.GRAMMAR_APPS_SCRIPT_URL, secret: process.env.GRAMMAR_SYNC_SECRET, fetch: globalThis.fetch };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url: String(url), options }); return fetchImpl(url, options); };
  try { await run(calls); } finally {
    globalThis.fetch = saved.fetch;
    if (saved.url === undefined) delete process.env.GRAMMAR_APPS_SCRIPT_URL; else process.env.GRAMMAR_APPS_SCRIPT_URL = saved.url;
    if (saved.secret === undefined) delete process.env.GRAMMAR_SYNC_SECRET; else process.env.GRAMMAR_SYNC_SECRET = saved.secret;
  }
}
const okUpstream = async () => ({ ok: true, json: async () => ({ ok: true, savedQuestions: [], reviewProgress: {}, revision: 0 }) });

test('proxy refuses to run without GRAMMAR_SYNC_SECRET or the Apps Script URL', async () => {
  for (const env of [
    { GRAMMAR_APPS_SCRIPT_URL: 'https://example.invalid/exec', GRAMMAR_SYNC_SECRET: undefined },
    { GRAMMAR_APPS_SCRIPT_URL: undefined, GRAMMAR_SYNC_SECRET: 'secret' },
  ]) {
    await withEnv(env, okUpstream, async calls => {
      for (const method of ['GET', 'POST']) {
        const res = response();
        await proxy({ method, body: '{"action":"save"}', query: {} }, res);
        assert.equal(res.code, 503, `${method} ${JSON.stringify(env)}`);
        assert.deepEqual(res.body, { ok: false, error: 'unconfigured' });
      }
      assert.equal(calls.length, 0, 'no upstream call without configuration');
    });
  }
});

test('proxy sends no wildcard CORS header and uses a timeout signal on every upstream fetch', async () => {
  await withEnv({ GRAMMAR_APPS_SCRIPT_URL: 'https://example.invalid/exec', GRAMMAR_SYNC_SECRET: 'secret' }, okUpstream, async calls => {
    const get = response();
    await proxy({ method: 'GET', query: { scope: 'structures' } }, get);
    const post = response();
    await proxy({ method: 'POST', body: JSON.stringify({ action: 'save', expectedRevision: 0, savedQuestions: [] }) }, post);
    for (const res of [get, post]) {
      assert.equal(res.code, 200);
      assert.equal(res.headers['access-control-allow-origin'], undefined);
    }
    assert.equal(calls.length, 2);
    for (const call of calls) assert.ok(call.options.signal instanceof AbortSignal, call.url);
    assert.equal(new URL(calls[0].url).searchParams.get('secret'), 'secret');
    assert.equal(JSON.parse(calls[1].options.body).secret, 'secret');
  });
});

test('proxy never returns internal error messages to the browser', async () => {
  const leak = 'connect ECONNREFUSED https://script.google.com/macros/s/PRIVATE/exec?secret=secret';
  await withEnv({ GRAMMAR_APPS_SCRIPT_URL: 'https://example.invalid/exec', GRAMMAR_SYNC_SECRET: 'secret' }, async () => { throw new Error(leak); }, async () => {
    for (const method of ['GET', 'POST']) {
      const res = response();
      await proxy({ method, body: '{"action":"save"}', query: {} }, res);
      assert.equal(res.code, 502);
      assert.ok(!JSON.stringify(res.body).includes('ECONNREFUSED'));
      assert.ok(!JSON.stringify(res.body).includes('PRIVATE'));
    }
  });
});

function appsScript(secret) {
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => key === 'GRAMMAR_SYNC_SECRET' ? secret : null }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => { throw new Error('sheet must not be touched when unauthorized'); }, flush() {} },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) },
  });
  vm.runInContext(readFileSync(new URL('../grammar-apps-script.js', import.meta.url), 'utf8'), context);
  return context;
}

test('Apps Script rejects every request while no secret is configured', () => {
  const script = appsScript(null);
  assert.equal(script.doGet({ parameter: {} }).error, 'unauthorized');
  assert.equal(script.doGet({ parameter: { scope: 'structures', secret: 'anything' } }).error, 'unauthorized');
  assert.equal(script.doPost({ postData: { contents: JSON.stringify({ action: 'save', secret: 'x' }) } }).error, 'unauthorized');
});

test('Apps Script with a secret accepts only the matching secret', () => {
  const script = appsScript('right');
  assert.equal(script.doGet({ parameter: { secret: 'wrong' } }).error, 'unauthorized');
  assert.equal(script.doPost({ postData: { contents: JSON.stringify({ action: 'save' }) } }).error, 'unauthorized');
  // The right secret passes authentication and reaches the spreadsheet layer.
  assert.match(script.doGet({ parameter: { secret: 'right' } }).error, /sheet must not be touched/);
});
