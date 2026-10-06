import { PILOTS, fetchTeam, changes } from './jdm.js';
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
async function refresh(env) {
  const results = [];
  let bindings = {};
  try { bindings = JSON.parse(env.JDM_TEAM_CODES || '{}'); } catch { throw new Error('JDM_TEAM_CODES debe ser JSON válido'); }
  for (const pilot of PILOTS) {
    try {
      const current = await fetchTeam({ ...pilot, ...bindings[pilot.slug] });
      const stored = await env.JDM_DB.prepare('SELECT payload FROM jdm_snapshots WHERE slug = ?').bind(pilot.slug).first();
      const previous = stored ? JSON.parse(stored.payload) : null;
      const updates = changes(previous, current);
      const checkedAt = new Date().toISOString();
      await env.JDM_DB.prepare('INSERT INTO jdm_snapshots(slug,payload,checked_at) VALUES(?,?,?) ON CONFLICT(slug) DO UPDATE SET payload=excluded.payload,checked_at=excluded.checked_at')
        .bind(pilot.slug, JSON.stringify(current), checkedAt).run();
      for (const update of updates) {
        await env.JDM_DB.prepare('INSERT INTO jdm_events(slug,match_id,before_json,after_json,created_at) VALUES(?,?,?,?,?)')
          .bind(pilot.slug, update.matchId, JSON.stringify(update.before), JSON.stringify(update.after), checkedAt).run();
      }
      results.push({ slug: pilot.slug, state: current.state, changes: updates.length });
    } catch (error) { results.push({ slug: pilot.slug, error: String(error) }); }
  }
  return results;
}
export default {
  async scheduled(_event, env, ctx) { ctx.waitUntil(refresh(env)); },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/jdm/refresh' && request.method === 'POST') {
      if (!env.JDM_REFRESH_TOKEN || request.headers.get('authorization') !== `Bearer ${env.JDM_REFRESH_TOKEN}`) return json({ error: 'No autorizado' }, 401);
      return json(await refresh(env));
    }
    if (url.pathname === '/api/jdm/teams' && request.method === 'GET') {
      const rows = await env.JDM_DB.prepare('SELECT slug,payload,checked_at FROM jdm_snapshots').all();
      const bySlug = new Map(rows.results.map(row => [row.slug, row]));
      return json(PILOTS.map(pilot => {
        const row = bySlug.get(pilot.slug);
        return row ? { ...JSON.parse(row.payload), checkedAt: row.checked_at } : { ...pilot, state: 'pending', fixtures: [], standings: [] };
      }));
    }
    if (url.pathname === '/api/jdm/events' && request.method === 'GET') {
      const slug = url.searchParams.get('slug');
      const since = Number(url.searchParams.get('since') || 0);
      if (!PILOTS.some(pilot => pilot.slug === slug) || !Number.isSafeInteger(since) || since < 0) return json({ error: 'Parámetros inválidos' }, 400);
      const rows = await env.JDM_DB.prepare('SELECT id,match_id,before_json,after_json,created_at FROM jdm_events WHERE slug = ? AND id > ? ORDER BY id LIMIT 100').bind(slug, since).all();
      return json(rows.results.map(row => ({ id: row.id, matchId: row.match_id, before: JSON.parse(row.before_json), after: JSON.parse(row.after_json), createdAt: row.created_at })));
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'No encontrado' }, 404);
    return env.ASSETS.fetch(request);
  }
};
