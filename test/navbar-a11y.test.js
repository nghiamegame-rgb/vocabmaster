/**
 * Tab buttons keep an accessible name on small screens (the visible label is
 * hidden below 640px), and index.html declares Vietnamese and an existing
 * favicon. Run: node test/navbar-a11y.test.js
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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

  await test('every tab button has an aria-label equal to its label', () => {
    const html = renderToStaticMarkup(createElement(Navbar, { activeTab: 'dashboard', setActiveTab() {}, syncStatus: 'idle', onSync() {} }));
    for (const [id, label] of [['dashboard', 'Dashboard'], ['vocabulary', 'Vocabulary'], ['flashcard', 'Flashcard'], ['quiz', 'Smart Quiz'], ['listening', 'Listening'], ['grammar', 'Grammar']]) {
      const button = html.match(new RegExp(`<button[^>]*id="nav-tab-${id}"[^>]*>`))?.[0];
      assert.ok(button, id);
      assert.match(button, new RegExp(`aria-label="${label}"`));
    }
  });

  await test('index.html uses lang="vi" and a favicon that exists in public/', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(html, /<html lang="vi">/);
    const icon = html.match(/<link rel="icon"[^>]*href="([^"]+)"/)?.[1];
    assert.equal(icon, '/favicon.svg');
    assert.ok(existsSync(new URL(`../public${icon}`, import.meta.url)));
  });
} finally {
  await server.close();
}
