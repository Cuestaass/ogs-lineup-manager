import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('las pantallas estrechas no conservan anchos intrínsecos ni rejillas de escritorio', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(css, /html \{[^}]*overflow-x: clip/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*?\.app-header \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.jdm-search \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(css, /\.app-header > \*, \.section-heading > \*, \.jdm-search > \* \{ min-width: 0;/);
});
