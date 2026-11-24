/**
 * Removed dead code/assets stay removed and the simplified Navbar sync states
 * still render. Run: node test/dead-code.test.js
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('unused files and folders are gone', () => {
  for (const file of ['src/App.css', 'src/assets/hero.png', 'src/assets/react.svg', 'src/assets/vite.svg', 'public/icons.svg', 'scripts']) {
    assert.equal(existsSync(new URL(`../${file}`, import.meta.url)), false, file);
  }
  assert.ok(existsSync(new URL('../public/favicon.svg', import.meta.url)), 'favicon used by index.html is kept');
});

test('unused exports and unreachable sync phases are gone', () => {
  assert.ok(!/importWords/.test(read('src/hooks/useVocabStore.js')));
  assert.ok(!/syncMode/.test(read('src/hooks/useVocabStore.js') + read('src/App.jsx') + read('src/components/Navbar.jsx')));
  assert.ok(!/clearWords/.test(read('src/utils/storage.js')));
  assert.ok(!/STRUCTURE_LEVEL_UP_THRESHOLD|calcStructureNextReviewAt/.test(read('src/utils/structureStorage.js')));
  assert.ok(!/Clearing|verifying/i.test(read('src/components/Navbar.jsx')));
});

const server = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});
try {
  const { default: Navbar } = await server.ssrLoadModule('/src/components/Navbar.jsx');
  await test('Navbar still shows every real sync state', () => {
    const render = (syncStatus, pushStatus = 'idle') => renderToStaticMarkup(createElement(Navbar, { activeTab: 'dashboard', setActiveTab() {}, syncStatus, pushStatus, onSync() {} }));
    assert.match(render('idle'), />Sync</);
    assert.match(render('syncing'), /Syncing…/);
    assert.match(render('ok'), /Synced!/);
    assert.match(render('error'), /Failed/);
    assert.match(render('idle', 'pushing'), /Saving…/);
    assert.match(render('idle', 'error'), /Save failed!/);
  });
} finally {
  await server.close();
}
