import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('El equipo ofrece sus cuatro secciones mediante navegación enlazable', async () => {
  const page = await readFile(new URL('../src/pages/TeamManagementPage.jsx', import.meta.url), 'utf8');

  for (const section of ['inicio', 'plantilla', 'convocatorias', 'ajustes']) {
    assert.match(page, new RegExp(`id: '${section}'`));
    assert.match(page, new RegExp(`visibleSection === '${section}'`));
  }
  assert.match(page, /aria-label="Secciones del equipo"/);
  assert.match(page, /href=\{`\/equipo\/#\$\{item\.id\}`\}/);
  assert.match(page, /window\.addEventListener\('hashchange'/);
});

test('la navegación de equipo conserva la visibilidad según permisos', async () => {
  const page = await readFile(new URL('../src/pages/TeamManagementPage.jsx', import.meta.url), 'utf8');

  assert.match(page, /id: 'plantilla',[^\n]+available: sportManager/);
  assert.match(page, /id: 'convocatorias',[^\n]+available: sportManager \|\| roles\.includes\('player'\)/);
  assert.match(page, /id: 'ajustes',[^\n]+available: manager/);
  assert.match(page, /manager && visibleSection === 'ajustes'/);
  assert.match(page, /roles\.includes\('player'\) && visibleSection === 'convocatorias'/);
});

test('la navegación de secciones se adapta a pantallas estrechas', async () => {
  const [baseCss, teamCss] = await Promise.all([
    readFile(new URL('../public/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/react.css', import.meta.url), 'utf8')
  ]);

  assert.match(baseCss, /@media \(max-width: 760px\)[\s\S]*?\.section-nav \{[^}]*flex-wrap: nowrap;[^}]*overflow-x: auto/);
  assert.match(teamCss, /\.team-overview-grid \{[^}]*repeat\(auto-fit, minmax\(190px, 1fr\)\)/);
});
