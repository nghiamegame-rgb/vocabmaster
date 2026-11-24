/**
 * ErrorBoundary: a render error shows a Vietnamese recovery message and a
 * reload button instead of a blank page. Run: node test/error-boundary.test.js
 * No browser, LocalStorage or network is used.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  const { default: ErrorBoundary } = await server.ssrLoadModule('/src/components/ErrorBoundary.jsx');

  await test('healthy children render unchanged', () => {
    const html = renderToStaticMarkup(createElement(ErrorBoundary, null, createElement('p', null, 'ok-child')));
    assert.equal(html, '<p>ok-child</p>');
  });

  await test('after an error the fallback shows the Vietnamese message and a reload button', () => {
    const state = ErrorBoundary.getDerivedStateFromError(new Error('boom'));
    assert.equal(state.hasError, true);
    const instance = new ErrorBoundary({ children: createElement('p', null, 'child') });
    instance.state = state;
    const html = renderToStaticMarkup(instance.render());
    assert.ok(html.includes('Có lỗi xảy ra, dữ liệu của bạn vẫn được giữ. Hãy tải lại trang'));
    assert.ok(/<button[^>]*>Tải lại trang<\/button>/.test(html));
    assert.ok(html.includes('role="alert"'));
    assert.ok(!html.includes('child'));
    assert.ok(!html.includes('boom'), 'error details must not be shown to the user');
  });

  await test('the reload button reloads the page', () => {
    let reloaded = 0;
    const previous = globalThis.window;
    globalThis.window = { location: { reload: () => { reloaded++; } } };
    try {
      const instance = new ErrorBoundary({});
      instance.state = { hasError: true };
      const button = instance.render().props.children.find(child => child?.type === 'button');
      button.props.onClick();
      assert.equal(reloaded, 1);
    } finally { globalThis.window = previous; }
  });

  await test('main.jsx wraps <App /> in the ErrorBoundary', () => {
    const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
    assert.match(main, /import ErrorBoundary from '\.\/components\/ErrorBoundary(\.jsx)?'/);
    assert.match(main, /<ErrorBoundary>\s*<App \/>\s*<\/ErrorBoundary>/);
  });
} finally {
  await server.close();
}
