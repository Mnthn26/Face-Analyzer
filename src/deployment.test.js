import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateBasePath } from '../scripts/site-config.mjs';

test('supports root hosting and the GitHub Pages project prefix', () => {
  assert.equal(validateBasePath('/'), '/');
  assert.equal(validateBasePath('/Face-Analyzer/'), '/Face-Analyzer/');
});

test('rejects external URLs, traversal, HTML and malformed deployment paths', () => {
  for (const path of ['https://example.com/', '//evil.com/', '/../', '/a/../', '/./', '/%2e%2e/', '/"><script>/', 'Face-Analyzer/', '/Face-Analyzer']) {
    assert.throws(() => validateBasePath(path));
  }
});

test('standalone homepage has no root-relative assets that break project hosting', async () => {
  const html = await readFile(new URL('../public/desk-assistant.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /(?:src|href)=["']\/(?!\/)/);
  assert.match(html, /getUserMedia/);
  assert.match(html, /<title>Deskwise/);
});
