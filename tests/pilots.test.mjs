import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PILOT_TEAMS } from '../pilots.js';

test('limita el programa sin pago a los tres equipos piloto acordados', () => {
  assert.deepEqual(PILOT_TEAMS.map(team => [team.slug, team.name]), [
    ['fc-ogs', 'FC OGS'],
    ['fc-ogs-ii', 'FC OGS II'],
    ['inter-maccabi', 'INTER MACCABI']
  ]);
});

test('las altas ordinarias no reciben equipo ni plan automáticamente', async () => {
  const worker = await readFile(new URL('../worker.js', import.meta.url), 'utf8');
  const ensureAccount = worker.match(/async function ensureAccount[\s\S]*?\n}/)?.[0] || '';
  assert.doesNotMatch(ensureAccount, /INSERT INTO teams/);
  assert.doesNotMatch(ensureAccount, /INSERT INTO team_members/);
  assert.match(worker, /NOT \(t\.name='Mi equipo'.*ts\.plan.*ts\.status/);
  assert.match(worker, /PILOT_BOOTSTRAP_TOKEN/);
});
