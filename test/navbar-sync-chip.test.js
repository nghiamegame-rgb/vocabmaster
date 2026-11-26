/**
 * The Vocabulary sync message lives in a small chip inside the navbar row (left of the
 * Sync button) instead of a floating box that covered the page. Same show/hide rules
 * and texts as before; push errors still take priority. Run: node test/navbar-sync-chip.test.js
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

globalThis.fetch = () => { throw new Error('Network must not be used'); };
const server = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});

try {
  const { default: Navbar } = await server.ssrLoadModule('/src/components/Navbar.jsx');
  const render = (syncStatus, pushStatus = 'idle') =>
    renderToStaticMarkup(createElement(Navbar, { activeTab: 'listening', setActiveTab() {}, syncStatus, pushStatus, onSync() {} }));
  const chipOf = html => html.match(/<span[^>]*data-sync-chip="([^"]+)"[^>]*class="([^"]*)"[^>]*>([^<]*)<\/span>/);
  const statusRegion = html => html.match(/<div id="nav-sync-status" role="status" aria-live="polite" class="([^"]*)">/);
  const syncButton = html => html.match(/<button[^>]*id="nav-sync-btn"[^>]*>/)?.[0] ?? '';

  await test('each state shows the same text as the old toast, with its colour', () => {
    const cases = [
      ['syncing', 'idle', 'syncing', '☁️ Fetching fresh data from Google Sheets…', 'indigo'],
      ['ok', 'idle', 'ok', '✅ Vocabulary synced successfully!', 'emerald'],
      ['error', 'idle', 'error', '❌ Vocabulary gặp lỗi — xem chi tiết bên dưới.', 'rose'],
      ['ok', 'error', 'push_error', '⚠️ Vocabulary chưa lưu/đồng bộ xong — xem chi tiết bên dưới.', 'rose'],
      ['idle', 'error', 'push_error', '⚠️ Vocabulary chưa lưu/đồng bộ xong — xem chi tiết bên dưới.', 'rose'],
    ];
    for (const [syncStatus, pushStatus, key, text, colour] of cases) {
      const chip = chipOf(render(syncStatus, pushStatus));
      assert.ok(chip, `${syncStatus}/${pushStatus}`);
      assert.equal(chip[1], key);
      assert.equal(chip[3], text);
      assert.match(chip[2], new RegExp(`text-${colour}-900`));
      assert.match(chip[2], /\btruncate\b/);
      assert.match(chip[2], /\btext-xs\b/);
      assert.doesNotMatch(chip[2], /\bfixed\b/);
    }
  });

  await test('nothing is shown when idle or for states without a message (paused)', () => {
    for (const status of ['idle', 'paused']) {
      const html = render(status);
      assert.equal(chipOf(html), null, status);
      assert.ok(statusRegion(html), 'the live region stays mounted so later messages are announced');
    }
  });

  await test('chip sits inside <nav>, before the Sync button; no floating toast remains', () => {
    const html = render('ok');
    const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
    assert.ok(nav.includes('id="nav-sync-status"'));
    assert.ok(nav.indexOf('id="nav-sync-status"') < nav.indexOf('id="nav-sync-btn"'));
    assert.equal(html.indexOf('</nav>') + '</nav>'.length, html.length, 'nothing rendered after the nav');
    assert.doesNotMatch(html, /top-\[72px\]/);
    assert.equal((html.match(/class="[^"]*\bfixed\b/g) || []).length, 1, 'only the navbar itself is fixed');
  });

  await test('below md the region is screen-reader only; from md it is a visible, shrinkable chip', () => {
    const cls = statusRegion(render('ok'))[1].split(/\s+/);
    for (const c of ['sr-only', 'md:not-sr-only', 'md:flex', 'md:min-w-0']) assert.ok(cls.includes(c), c);
  });

  await test('Sync button title carries the current message, and keeps its explanation', () => {
    assert.match(syncButton(render('ok')), /title="✅ Vocabulary synced successfully! — Đọc Vocabulary mới nhất/);
    assert.match(syncButton(render('idle', 'error')), /title="⚠️ Vocabulary chưa lưu\/đồng bộ xong/);
    assert.match(syncButton(render('idle')), /title="Đọc Vocabulary mới nhất và thử gửi thay đổi đang chờ; không xóa cache"/);
  });
} finally {
  await server.close();
}
