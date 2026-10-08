const BASE = 'https://datos.madrid.es/api/3/action/datastore_search';
const RESOURCES = { matches: '211549-0-juegos-deportivos-actual-csv', standings: '211549-2-juegos-deportivos-actual-csv' };
export const PILOTS = [
  { slug: 'fc-ogs', name: 'FC OGS' },
  { slug: 'fc-ogs-ii', name: 'FC OGS II' },
  { slug: 'inter-maccabi', name: 'Inter Maccabi' }
];
const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, ' ').trim().toUpperCase();
const number = value => value === '' || value == null ? null : Number(value);
export const seasonStart = (date = new Date()) => date.getUTCMonth() >= 7 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;

async function search(resource, params = {}) {
  const url = new URL(BASE);
  url.searchParams.set('resource_id', RESOURCES[resource]);
  url.searchParams.set('limit', '1000');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`JDM respondió ${response.status}`);
  const data = await response.json();
  if (!data.success || !Array.isArray(data.result?.records)) throw new Error('Respuesta JDM inválida');
  return data.result.records;
}

function matchId(row) {
  return [row.Codigo_temporada, row.Codigo_competicion, row.Codigo_fase, row.Codigo_grupo, row.Jornada, row.Partido].join(':');
}
function fixture(row, teamCode) {
  return {
    id: matchId(row), season: number(row.Codigo_temporada), round: number(row.Jornada),
    home: row.Equipo_local, away: row.Equipo_visitante,
    homeCode: String(row.Codigo_equipo1), awayCode: String(row.Codigo_equipo2),
    date: row.Fecha || null, time: row.Hora || null, venue: row.Campo || null,
    scheduled: String(row.Programado) === '1', status: row.Estado || '',
    observation: row.Observaciones || '', isHome: String(row.Codigo_equipo1) === String(teamCode)
  };
}
function rank(row) {
  return {
    team: row.Nombre_equipo, teamCode: String(row.Codigo_equipo), position: number(row.Posicion),
    points: number(row.Puntos), played: number(row.Partidos_jugados), won: number(row.Partidos_ganados),
    drawn: number(row.Partidos_empatados), lost: number(row.Partidos_perdidos),
    goalsFor: number(row.Goles_favor), goalsAgainst: number(row.Goles_contra)
  };
}
function candidateKey(candidate) {
  return [candidate.Codigo_temporada, candidate.Codigo_competicion, candidate.Codigo_fase, candidate.Codigo_grupo, candidate.Codigo_equipo].join(':');
}
function candidatesFromMatch(row, teamName) {
  const common = {
    Codigo_temporada: row.Codigo_temporada,
    Codigo_competicion: row.Codigo_competicion,
    Codigo_fase: row.Codigo_fase,
    Codigo_grupo: row.Codigo_grupo,
    Nombre_grupo: row.Nombre_grupo,
    Nombre_deporte: row.Nombre_deporte,
    Nombre_distrito: row.Distrito
  };
  return [
    { ...common, Codigo_equipo: row.Codigo_equipo1, Nombre_equipo: row.Equipo_local },
    { ...common, Codigo_equipo: row.Codigo_equipo2, Nombre_equipo: row.Equipo_visitante }
  ].filter(candidate => norm(candidate.Nombre_equipo) === norm(teamName));
}
export function changes(previous, current) {
  const old = new Map((previous?.fixtures || []).map(item => [item.id, item]));
  if (!previous) return [];
  return current.fixtures.flatMap(item => {
    const before = old.get(item.id);
    if (!before) return [];
    const fields = ['date', 'time', 'venue', 'scheduled', 'status'];
    return fields.some(field => before[field] !== item[field]) ? [{ matchId: item.id, before, after: item }] : [];
  });
}
export async function fetchTeam(pilot, season = seasonStart()) {
  // At the start of a season Madrid can publish the calendar before every group
  // appears in the standings file. Discover the team from both resources so a
  // missing classification does not hide fixtures that are already official.
  const [standingCandidates, matchRows] = await Promise.all([
    search('standings', { q: pilot.name }),
    search('matches', { q: pilot.name })
  ]);
  const candidates = [
    ...standingCandidates.filter(row => norm(row.Nombre_equipo) === norm(pilot.name)),
    ...matchRows.flatMap(row => candidatesFromMatch(row, pilot.name))
  ];
  const unique = [...new Map(candidates.map(candidate => [candidateKey(candidate), candidate])).values()];
  const exact = unique.filter(row => number(row.Codigo_temporada) === season && (!pilot.teamCode || String(row.Codigo_equipo) === String(pilot.teamCode)) && (!pilot.groupCode || String(row.Codigo_grupo) === String(pilot.groupCode)));
  if (exact.length === 0) return { slug: pilot.slug, name: pilot.name, season, state: 'unavailable', fixtures: [], standings: [] };
  if (exact.length > 1) return { slug: pilot.slug, name: pilot.name, season, state: 'ambiguous', choices: exact.map(row => ({ teamCode: String(row.Codigo_equipo), group: row.Nombre_grupo, district: row.Nombre_distrito, sport: row.Nombre_deporte })), fixtures: [], standings: [] };
  const row = exact[0];
  const group = { Codigo_temporada: row.Codigo_temporada, Codigo_competicion: row.Codigo_competicion, Codigo_fase: row.Codigo_fase, Codigo_grupo: row.Codigo_grupo };
  const standingRows = await search('standings', { filters: group });
  const code = String(row.Codigo_equipo);
  const fixtures = matchRows.filter(match =>
    number(match.Codigo_temporada) === season &&
    String(match.Codigo_competicion) === String(row.Codigo_competicion) &&
    String(match.Codigo_fase) === String(row.Codigo_fase) &&
    String(match.Codigo_grupo) === String(row.Codigo_grupo) &&
    (String(match.Codigo_equipo1) === code || String(match.Codigo_equipo2) === code)
  ).map(match => fixture(match, code)).sort((a, b) => `${a.date || '9999'} ${a.time || ''}`.localeCompare(`${b.date || '9999'} ${b.time || ''}`));
  return { slug: pilot.slug, name: row.Nombre_equipo, teamCode: code, season, state: 'ready', group: row.Nombre_grupo,
    district: row.Nombre_distrito, sport: row.Nombre_deporte,
    fixtures, standings: standingRows.filter(item => number(item.Codigo_temporada) === season).map(rank).sort((a,b) => a.position - b.position) };
}
