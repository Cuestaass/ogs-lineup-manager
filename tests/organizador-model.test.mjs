import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCallupToTeam, defaultState, eligibleTeamPlayers, loadState, saveState, syncRosterPlayers } from '../public/organizador/model.js';

test('conserva equipos existentes y normaliza sus cambios naturales', () => {
  const records = new Map();
  globalThis.localStorage = {
    getItem: key => records.get(key) || null,
    setItem: (key, value) => records.set(key, value)
  };
  records.set('fc-ogs-organizer-v1', JSON.stringify({
    nextTeamId: 2, nextPlayerId: 3,
    teams: [{ id: 1, name: 'FC OGS', formation: '321', lineup: [1], naturalSubs: [{ starterId: '1', substituteId: '2' }] }],
    players: [{ id: 1, name: 'Titular', number: 7, teamIds: [1] }]
  }));
  const state = loadState();
  assert.equal(state.teams[0].lineup.length, 7);
  assert.deepEqual(state.teams[0].naturalSubs, [{ starterId: 1, substituteId: 2 }]);
  saveState(state);
  assert.equal(JSON.parse(records.get('fc-ogs-organizer-v1')).teams[0].name, 'FC OGS');
  delete globalThis.localStorage;
});

test('migra y guarda cada equipo en un espacio aislado', () => {
  const records = new Map();
  globalThis.localStorage = { getItem: key => records.get(key) || null, setItem: (key, value) => records.set(key, value) };
  globalThis.__OGS_TEAM__ = { id: 'local-2', name: 'Equipo B' };
  records.set('fc-ogs-organizer-v1', JSON.stringify({
    nextTeamId: 3, nextPlayerId: 3,
    teams: [
      { id: 1, name: 'Equipo A', formation: '321', lineup: [1], naturalSubs: [] },
      { id: 2, name: 'Equipo B', formation: '231', lineup: [2], naturalSubs: [] }
    ],
    players: [
      { id: 1, name: 'A', number: 1, teamIds: [1] },
      { id: 2, name: 'B', number: 2, teamIds: [2] }
    ]
  }));
  const state = loadState();
  assert.deepEqual(state.teams.map(team => team.name), ['Equipo B']);
  assert.deepEqual(state.players.map(player => player.name), ['B']);
  saveState(state);
  assert.equal(JSON.parse(records.get('ogs-organizer-v2:local-2')).teams[0].name, 'Equipo B');
  delete globalThis.__OGS_TEAM__;
  delete globalThis.localStorage;
});

test('combina la plantilla persistente con refuerzos temporales y filtra por convocatoria', () => {
  const state = defaultState();
  syncRosterPlayers(state, [
    { id: 'roster-1', display_name: 'Convocado', number: 7 },
    { id: 'roster-2', display_name: 'No convocado', number: 8 }
  ]);
  state.players.push({ id: state.nextPlayerId++, name: 'Refuerzo', number: 9, teamIds: [1], origin: 'temporary' });
  state.teams[0].lineup = [state.players.find(player => player.sourceId === 'roster-2').id, null, null, null, null, null, null];

  applyCallupToTeam(state, 1, { id: 'callup-1', players: [{ id: 'roster-1' }] });
  assert.deepEqual(eligibleTeamPlayers(state, 1).map(player => player.name), ['Convocado', 'Refuerzo']);
  assert.equal(state.teams[0].lineup[0], null);

  syncRosterPlayers(state, [{ id: 'roster-1', display_name: 'Convocado actualizado', number: 10 }]);
  assert.deepEqual(state.players.map(player => player.name), ['Convocado actualizado', 'Refuerzo']);
});

test('un fallo de almacenamiento mantiene los cambios pendientes hasta reintentar', async () => {
  const { createLineupSaver } = await import('../public/organizador/model.js');
  const statuses = [];
  let blocked = true;
  let stored;
  const saver = createLineupSaver({ write: state => {
    if (blocked) throw new Error('QuotaExceededError');
    stored = structuredClone(state);
  }, onStatus: status => statuses.push(status) });
  const state = defaultState();
  assert.equal(saver.save(state), false);
  assert.equal(saver.pending, true);
  assert.deepEqual(statuses, ['pending', 'error']);
  state.teams[0].formation = '231';
  blocked = false;
  assert.equal(saver.save(state), true);
  assert.equal(saver.pending, false);
  assert.equal(stored.teams[0].formation, '231');
  assert.equal(statuses.at(-1), 'saved');
});

test('el guardado captura el equipo original aunque cambie el equipo activo', async () => {
  const { createLineupSaver } = await import('../public/organizador/model.js');
  const records = new Map();
  globalThis.localStorage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
  try {
    globalThis.__OGS_TEAM__ = { id: 'team-a' };
    const saver = createLineupSaver();
    const state = defaultState();
    state.teams[0].formation = '222';
    globalThis.__OGS_TEAM__ = { id: 'team-b' };
    saver.save(state);
    assert.equal(records.has('ogs-organizer-v2:team-b'), false);
    assert.equal(loadState().teams[0].formation, '321');
    globalThis.__OGS_TEAM__ = { id: 'team-a' };
    assert.equal(loadState().teams[0].formation, '222');
  } finally {
    delete globalThis.__OGS_TEAM__;
    delete globalThis.localStorage;
  }
});

test('distingue un registro ilegible de uno vacío sin borrar la copia anterior', () => {
  let errors = 0;
  globalThis.localStorage = { getItem: () => '{invalid', setItem: () => assert.fail('no debe escribir') };
  try {
    loadState({ onError: () => errors++ });
    assert.equal(errors, 1);
    globalThis.localStorage.getItem = () => { throw new Error('SecurityError'); };
    loadState({ onError: () => errors++ });
    assert.equal(errors, 2);
    globalThis.localStorage.getItem = () => null;
    loadState({ onError: () => errors++ });
    assert.equal(errors, 2);
  } finally { delete globalThis.localStorage; }
});
