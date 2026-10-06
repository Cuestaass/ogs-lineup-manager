import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadState, saveState } from '../public/organizador/model.js';

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
