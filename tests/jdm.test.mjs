import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchTeam, changes, searchTeams, seasonStart } from '../jdm.js';

test('identifica un equipo por temporada y código y muestra grupo y partidos', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => {
    const u = new URL(url);
    calls.push(u);
    const resource = u.searchParams.get('resource_id');
    const records = resource.includes('211549-2') ?
      (u.searchParams.has('filters') ? [standing] : [{ ...standing, Codigo_temporada: '2025' }, standing]) : [match];
    return { ok: true, json: async () => ({ success: true, result: { records } }) };
  };
  const standing = { Codigo_temporada: '2026', Codigo_competicion: 'JDM', Codigo_fase: '1', Codigo_grupo: '2', Codigo_equipo: '42', Nombre_equipo: 'FC OGS', Nombre_grupo: 'GRUPO 2', Nombre_deporte: 'FUTBOL 7', Nombre_distrito: 'CENTRO', Posicion: '3', Puntos: '9', Partidos_jugados: '4' };
  const match = { Codigo_temporada: '2026', Codigo_competicion: 'JDM', Codigo_fase: '1', Codigo_grupo: '2', Codigo_equipo1: '42', Codigo_equipo2: '73', Jornada: '5', Partido: '1', Equipo_local: 'FC OGS', Equipo_visitante: 'RIVAL', Fecha: '2026-10-10', Hora: '12:00', Programado: '1' };
  try {
    const result = await fetchTeam({ slug: 'fc-ogs', name: 'FC OGS' }, 2026);
    assert.equal(result.state, 'ready');
    assert.equal(result.standings[0].points, 9);
    assert.equal(result.fixtures[0].id, '2026:JDM:1:2:5:1');
    assert.equal(calls.length, 3);
  } finally { globalThis.fetch = original; }
});

test('avisa solo al cambiar la programación de un partido ya conocido', () => {
  const fixture = { id: 'x', date: '2026-10-10', time: '12:00', venue: 'A', scheduled: true, status: '' };
  assert.equal(changes(null, { fixtures: [fixture] }).length, 0);
  assert.equal(changes({ fixtures: [fixture] }, { fixtures: [{ ...fixture, time: '13:00' }] }).length, 1);
  assert.equal(changes({ fixtures: [fixture] }, { fixtures: [fixture] }).length, 0);
});

test('muestra el calendario aunque el grupo aún no figure en clasificaciones', async () => {
  const original = globalThis.fetch;
  const match = {
    Codigo_temporada: '2026', Codigo_competicion: '9023', Codigo_fase: '10069', Codigo_grupo: '31480',
    Codigo_equipo1: '193631', Codigo_equipo2: '193524', Jornada: '1', Partido: '5',
    Equipo_local: 'Inter Maccabi', Equipo_visitante: 'U.B. Prosperidad', Fecha: '2026-10-18',
    Hora: '19:20', Programado: '1', Estado: 'R', Nombre_grupo: 'JDM SAL DOM TAR F7 SEN MAS Gr-6',
    Nombre_deporte: 'FUTBOL 7', Distrito: 'Salamanca'
  };
  globalThis.fetch = async url => {
    const resource = new URL(url).searchParams.get('resource_id');
    const records = resource.includes('211549-0') ? [match] : [];
    return { ok: true, json: async () => ({ success: true, result: { records } }) };
  };
  try {
    const result = await fetchTeam({ slug: 'inter-maccabi', name: 'Inter Maccabi' }, 2026);
    assert.equal(result.state, 'ready');
    assert.equal(result.teamCode, '193631');
    assert.equal(result.district, 'Salamanca');
    assert.equal(result.fixtures.length, 1);
    assert.deepEqual(result.standings, []);
  } finally { globalThis.fetch = original; }
});

test('la temporada cambia en agosto', () => {
  assert.equal(seasonStart(new Date('2026-07-31T12:00:00Z')), 2025);
  assert.equal(seasonStart(new Date('2026-08-01T12:00:00Z')), 2026);
});

test('busca equipos oficiales dinámicamente sin una lista piloto', async () => {
  const original = globalThis.fetch;
  const standing = { Codigo_temporada: '2026', Codigo_competicion: 'JDM', Codigo_fase: '1', Codigo_grupo: '8', Codigo_equipo: '77', Nombre_equipo: 'Barrio Norte', Nombre_grupo: 'GRUPO 8', Nombre_deporte: 'FUTBOL 7', Nombre_distrito: 'CENTRO' };
  globalThis.fetch = async url => {
    const resource = new URL(url).searchParams.get('resource_id');
    return { ok: true, json: async () => ({ success: true, result: { records: resource.includes('211549-2') ? [standing] : [] } }) };
  };
  try {
    const results = await searchTeams('barrio', 2026);
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'Barrio Norte');
    assert.equal(results[0].teamCode, '77');
    assert.match(results[0].slug, /2026-jdm-1-8-77/);
  } finally { globalThis.fetch = original; }
});

test('permite buscar equipos por liga o distrito', async () => {
  const original = globalThis.fetch;
  const rows = [
    { Codigo_temporada: '2026', Codigo_competicion: 'JDM', Codigo_fase: '1', Codigo_grupo: '8', Codigo_equipo: '77', Nombre_equipo: 'Barrio Norte', Nombre_grupo: 'LIGA CENTRO', Nombre_deporte: 'FUTBOL 7', Nombre_distrito: 'CENTRO' },
    { Codigo_temporada: '2026', Codigo_competicion: 'JDM', Codigo_fase: '1', Codigo_grupo: '9', Codigo_equipo: '78', Nombre_equipo: 'Barrio Sur', Nombre_grupo: 'LIGA SUR', Nombre_deporte: 'FUTBOL 7', Nombre_distrito: 'USERA' }
  ];
  globalThis.fetch = async url => ({ ok: true, json: async () => ({ success: true, result: { records: new URL(url).searchParams.get('resource_id').includes('211549-2') ? rows : [] } }) });
  try {
    assert.deepEqual((await searchTeams({ district: 'centro' }, 2026)).map(team => team.name), ['Barrio Norte']);
    assert.deepEqual((await searchTeams({ league: 'liga sur' }, 2026)).map(team => team.name), ['Barrio Sur']);
  } finally { globalThis.fetch = original; }
});
