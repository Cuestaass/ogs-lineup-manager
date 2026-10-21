import assert from 'node:assert/strict';
import test from 'node:test';
import { goalsForMatch } from '../src/lib/matchStats.js';

test('cada acta contiene sólo los goles del identificador oficial exacto', () => {
  const goals = [
    { id: 'a', match_id: '2026:JDM:1:2:5:1', minute: 20 },
    { id: 'b', match_id: '2026:JDM:1:3:5:1', minute: 10 },
    { id: 'c', match_id: '2025:JDM:1:2:5:1', minute: 15 }
  ];
  assert.deepEqual(goalsForMatch(goals, '2026:JDM:1:2:5:1').map(goal => goal.id), ['a']);
  assert.deepEqual(goalsForMatch(goals, 'missing'), []);
});

test('ordena los minutos incluido cero y conserva todos los goles sin minuto sin mutar los datos', () => {
  const goals = [
    { id: 'unknown', match_id: 'match', minute: null },
    { id: 'late', match_id: 'match', minute: 90 },
    { id: 'zero', match_id: 'match', minute: 0 },
    { id: 'another', match_id: 'match', minute: null },
    { id: 'early', match_id: 'match', minute: 5 }
  ];
  assert.deepEqual(goalsForMatch(goals, 'match').map(goal => goal.id), ['zero', 'early', 'late', 'unknown', 'another']);
  assert.equal(goals[0].id, 'unknown');
});
