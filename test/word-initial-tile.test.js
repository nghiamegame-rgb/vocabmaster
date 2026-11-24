/**
 * Words without an imageUrl show a local initial-letter tile; the app never
 * calls source.unsplash.com (or any image service) as a fallback.
 * Run: node test/word-initial-tile.test.js
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

globalThis.fetch = () => { throw new Error('Network must not be used'); };
const files = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? files(path) : [path];
});

test('no source file uses the external Unsplash fallback', () => {
  const offenders = files('src').filter(path => /\.(jsx?|css)$/.test(path))
    .filter(path => /unsplash/i.test(readFileSync(path, 'utf8')));
  assert.deepEqual(offenders, []);
});

test('Listening and Smart Quiz use the initial-letter tile', () => {
  for (const file of ['src/components/ListeningReview.jsx', 'src/components/Quiz.jsx']) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /import WordInitialTile from '\.\/WordInitialTile'/, file);
    assert.match(source, /<WordInitialTile /, file);
  }
});

const server = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});
try {
  const { default: WordInitialTile } = await server.ssrLoadModule('/src/components/WordInitialTile.jsx');
  await test('the tile shows the uppercase first letter, without images or links', () => {
    const render = word => renderToStaticMarkup(createElement(WordInitialTile, { word }));
    assert.match(render('negotiate'), />N<\/div>$/);
    assert.match(render('  take off'), />T<\/div>$/);
    assert.match(render('élan'), />É<\/div>$/);
    assert.match(render('𝒳-ray'), />𝒳<\/div>$/);
    assert.match(render(''), />\?<\/div>$/);
    const html = render('negotiate');
    assert.ok(!/<img|https?:/.test(html));
    assert.match(html, /aria-hidden="true"/);
  });
} finally {
  await server.close();
}
