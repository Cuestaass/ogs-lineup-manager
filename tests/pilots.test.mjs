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

test('las altas ordinarias no reciben el plan piloto automáticamente', async () => {
  const worker = await readFile(new URL('../worker.js', import.meta.url), 'utf8');
  assert.match(worker, /VALUES\(\?,'free','inactive',\?\)/);
  assert.match(worker, /PILOT_BOOTSTRAP_TOKEN/);
});
