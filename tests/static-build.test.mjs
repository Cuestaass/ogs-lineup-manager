import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { buildStaticBundle } from '../scripts/build-static.mjs';

const read = path => readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8');
const sources = { model: read('organizador/model.js'), pdf: read('organizador/pdf-import.js'), app: read('app.js') };

test('el bundle conserva el alias de guardado y persiste los cambios de la aplicación', () => {
  const records = new Map();
  const bundle = buildStaticBundle({ ...sources, app: `
import { defaultState, loadState, saveState as persistState } from './organizador/model.js';
(() => {
  const state = defaultState();
  function saveState() { persistState(state); }
  state.players.push({ id: 1, name: 'Jugador', number: 7, teamIds: [1] });
  state.teams[0].lineup[0] = 1;
  saveState();
  globalThis.restored = loadState();
})();
` });
  const context = { localStorage: {
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value)
  } };
  runInNewContext(bundle, context);
  assert.equal(context.restored.players[0].name, 'Jugador');
  assert.equal(context.restored.teams[0].lineup[0], 1);
});

test('el archivo servido coincide con el generado desde los módulos actuales', () => {
  assert.equal(read('app.bundle.js'), buildStaticBundle(sources));
});
