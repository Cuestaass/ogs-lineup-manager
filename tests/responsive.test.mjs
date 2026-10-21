import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('las pantallas estrechas no conservan anchos intrínsecos ni rejillas de escritorio', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(css, /html \{[^}]*overflow-x: clip/);
  assert.match(css, /body \{[^}]*min-width: 0/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*?\.app-header \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.jdm-search \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(css, /\.app-header > \*, \.section-heading > \*, \.jdm-search > \* \{ min-width: 0;/);
});

test('la navegación móvil mantiene visibles las acciones autorizadas sin tapar el contenido', async () => {
  const [css, shell] = await Promise.all([
    readFile(new URL('../public/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/AppShell.jsx', import.meta.url), 'utf8')
  ]);
  assert.match(shell, /className="mobile-nav"[^>]*aria-label="Navegación móvil"/);
  assert.match(shell, /visibleItems\.map/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?body \{ padding-bottom: calc\(70px \+ env\(safe-area-inset-bottom\)\); \}/);
  assert.match(css, /\.mobile-nav \{[\s\S]*?position: fixed;[\s\S]*?grid-template-columns:/);
  assert.match(css, /\.feedback:not\(:empty\) \{ bottom: calc\(78px \+ env\(safe-area-inset-bottom\)\); \}/);
});
