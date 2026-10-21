import { fetchTeam, changes, searchTeams } from './jdm.js';
import { hasPermission, permissionsForRoles, primaryRole, subscriptionAllows, validateInvite } from './access.js';
import { PILOT_TEAMS } from './pilots.js';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const encode = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const hashToken = async token => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))].map(value => value.toString(16).padStart(2, '0')).join('');
const managementPermissions = new Set(['billing.manage', 'team.manage', 'members.manage', 'members.invite', 'roster.manage', 'callups.manage', 'tactics.manage', 'lineups.manage', 'goals.record']);
const claimName = claims => claims.user_metadata?.full_name || claims.user_metadata?.name || claims.name || claims.preferred_username || claims.email || 'Usuario';

function allowedOrigin(request, env) {
  const origin = request.headers.get('origin');
  if (!origin) return '';
  const configured = [env.FRONTEND_URL, ...(env.ALLOWED_ORIGINS || '').split(',')].map(value => String(value || '').trim().replace(/\/$/, '')).filter(Boolean);
  if (configured.includes(origin)) return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return '';
}

function withCors(response, request, env) {
  const origin = allowedOrigin(request, env);
  if (!origin) return response;
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', origin);
  headers.set('access-control-allow-headers', 'authorization, content-type');
  headers.set('access-control-allow-methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  headers.set('vary', 'Origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
let supabaseJwks;
let supabaseIssuer;

async function authenticate(request, env) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token || !env.SUPABASE_URL) throw new Response('', { status: 401 });
  const issuer = `${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1`;
  if (!supabaseJwks || supabaseIssuer !== issuer) {
    supabaseIssuer = issuer;
    supabaseJwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), { cacheMaxAge: 10 * 60 * 1000 });
  }
  try {
    const { payload } = await jwtVerify(token, supabaseJwks, {
      issuer,
      audience: env.SUPABASE_JWT_AUDIENCE || 'authenticated',
      algorithms: ['RS256', 'ES256']
    });
    return payload;
  } catch {
    throw new Response('', { status: 401 });
  }
}

async function ensureAccount(env, claims) {
  const userId = String(claims.sub);
  const displayName = claimName(claims);
  await env.JDM_DB.prepare('INSERT INTO users(id,email,display_name) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,display_name=excluded.display_name').bind(userId, claims.email || null, displayName).run();
  const workspace = await env.JDM_DB.prepare('SELECT w.id,w.name FROM workspaces w JOIN workspace_members wm ON wm.workspace_id=w.id WHERE wm.user_id=? ORDER BY w.created_at LIMIT 1').bind(userId).first();
  return { userId, workspace };
}

async function teamAccess(env, userId, teamId) {
  const member = await env.JDM_DB.prepare("SELECT tm.role,tm.status FROM team_members tm JOIN teams t ON t.id=tm.team_id LEFT JOIN team_subscriptions ts ON ts.team_id=t.id WHERE tm.team_id=? AND tm.user_id=? AND NOT (t.name='Mi equipo' AND t.external_team_slug IS NULL AND COALESCE(ts.plan,'free')='free' AND COALESCE(ts.status,'inactive')='inactive')").bind(teamId, userId).first();
  if (!member || member.status !== 'active') return null;
  const roleRows = await env.JDM_DB.prepare('SELECT role FROM team_member_roles WHERE team_id=? AND user_id=?').bind(teamId, userId).all();
  const roles = roleRows.results.length ? roleRows.results.map(row => row.role) : [member.role];
  const subscription = await env.JDM_DB.prepare('SELECT plan,status,current_period_end FROM team_subscriptions WHERE team_id=?').bind(teamId).first();
  return { role: primaryRole(roles), roles, subscription: subscription || { plan: 'free', status: 'inactive' } };
}

async function requirePermission(env, userId, teamId, permission) {
  const access = await teamAccess(env, userId, teamId);
  if (!access) throw new Response('', { status: 403 });
  if (!hasPermission(access.roles, permission)) throw new Response('', { status: 403 });
  if (managementPermissions.has(permission) && !subscriptionAllows(access.subscription, 'team_management')) throw new Response(JSON.stringify({ error: 'La gestión de equipo requiere una suscripción activa.' }), { status: 402, headers: { 'content-type': 'application/json' } });
  return access;
}

async function allFollowed(env) {
  const rows = await env.JDM_DB.prepare('SELECT DISTINCT slug,name,team_code,group_code FROM user_follows ORDER BY name').all();
  return rows.results.map(row => ({ slug: row.slug, name: row.name, teamCode: row.team_code, groupCode: row.group_code }));
}

async function subscribeAssignedTeam(env, userId, teamId) {
  await env.JDM_DB.prepare("INSERT OR IGNORE INTO user_follows(user_id,slug,name,team_code,group_code) SELECT ?,external_team_slug,name,external_team_code,external_group_code FROM teams WHERE id=? AND external_team_slug IS NOT NULL AND external_team_code IS NOT NULL AND external_group_code IS NOT NULL").bind(userId, teamId).run();
}

async function subscribeAssignedTeams(env, userId) {
  await env.JDM_DB.prepare("INSERT OR IGNORE INTO user_follows(user_id,slug,name,team_code,group_code) SELECT tm.user_id,t.external_team_slug,t.name,t.external_team_code,t.external_group_code FROM team_members tm JOIN teams t ON t.id=tm.team_id WHERE tm.user_id=? AND tm.status='active' AND t.external_team_slug IS NOT NULL AND t.external_team_code IS NOT NULL AND t.external_group_code IS NOT NULL").bind(userId).run();
}

async function subscribeAllTeamMembers(env, teamId) {
  await env.JDM_DB.prepare("INSERT OR IGNORE INTO user_follows(user_id,slug,name,team_code,group_code) SELECT tm.user_id,t.external_team_slug,t.name,t.external_team_code,t.external_group_code FROM team_members tm JOIN teams t ON t.id=tm.team_id WHERE t.id=? AND tm.status='active' AND t.external_team_slug IS NOT NULL AND t.external_team_code IS NOT NULL AND t.external_group_code IS NOT NULL").bind(teamId).run();
}

async function isLastActiveManager(env, teamId, userId) {
  const target = await env.JDM_DB.prepare("SELECT 1 ok FROM team_member_roles r JOIN team_members tm ON tm.team_id=r.team_id AND tm.user_id=r.user_id WHERE r.team_id=? AND r.user_id=? AND r.role='manager' AND tm.status='active'").bind(teamId, userId).first();
  if (!target) return false;
  const managers = await env.JDM_DB.prepare("SELECT COUNT(*) total FROM team_member_roles r JOIN team_members tm ON tm.team_id=r.team_id AND tm.user_id=r.user_id WHERE r.team_id=? AND r.role='manager' AND tm.status='active'").bind(teamId).first();
  return Number(managers?.total || 0) <= 1;
}

async function cleanupWorkspaceMembership(env, teamId, userId) {
  const team = await env.JDM_DB.prepare('SELECT workspace_id FROM teams WHERE id=?').bind(teamId).first();
  if (!team) return;
  const anotherTeam = await env.JDM_DB.prepare("SELECT 1 ok FROM team_members tm JOIN teams t ON t.id=tm.team_id WHERE t.workspace_id=? AND tm.user_id=? AND tm.status='active' LIMIT 1").bind(team.workspace_id, userId).first();
  if (!anotherTeam) await env.JDM_DB.prepare('DELETE FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(team.workspace_id, userId).run();
}

async function inspectInvite(env, token) {
  const invitation = await env.JDM_DB.prepare('SELECT i.id,i.role,i.mode,i.max_uses,i.use_count,i.expires_at,i.revoked_at,t.name team_name FROM team_invites i JOIN teams t ON t.id=i.team_id WHERE i.token_hash=?').bind(await hashToken(token)).first();
  if (!invitation) return null;
  return {
    teamName: invitation.team_name, role: invitation.role, mode: invitation.mode,
    remainingUses: Math.max(0, invitation.max_uses - invitation.use_count), expiresAt: invitation.expires_at,
    valid: !invitation.revoked_at && invitation.use_count < invitation.max_uses && invitation.expires_at > new Date().toISOString()
  };
}

async function provisionPilots(request, env) {
  if (!env.PILOT_BOOTSTRAP_TOKEN || request.headers.get('x-pilot-bootstrap-token') !== env.PILOT_BOOTSTRAP_TOKEN) return json({ error: 'No autorizado' }, 401);
  const body = await request.json();
  const managers = Array.isArray(body.managers) ? body.managers : [];
  const requested = new Map(managers.map(item => [String(item.teamSlug || ''), String(item.email || '').trim().toLowerCase()]));
  if (requested.size !== PILOT_TEAMS.length || PILOT_TEAMS.some(team => !requested.get(team.slug))) return json({ error: 'Debes indicar exactamente un correo para cada uno de los tres equipos piloto.' }, 400);

  const results = [];
  for (const pilot of PILOT_TEAMS) {
    const email = requested.get(pilot.slug);
    const user = await env.JDM_DB.prepare('SELECT id FROM users WHERE lower(email)=?').bind(email).first();
    if (!user) {
      results.push({ team: pilot.name, email, state: 'pending-login' });
      continue;
    }
    let team = await env.JDM_DB.prepare('SELECT id,workspace_id FROM teams WHERE pilot_slug=? LIMIT 1').bind(pilot.slug).first();
    if (!team) {
      team = await env.JDM_DB.prepare("SELECT t.id,t.workspace_id FROM teams t JOIN team_members tm ON tm.team_id=t.id JOIN team_member_roles tmr ON tmr.team_id=tm.team_id AND tmr.user_id=tm.user_id LEFT JOIN team_subscriptions ts ON ts.team_id=t.id WHERE tm.user_id=? AND tmr.role='manager' AND t.name='Mi equipo' AND t.external_team_slug IS NULL AND COALESCE(ts.plan,'free')='free' AND COALESCE(ts.status,'inactive')='inactive' ORDER BY t.created_at LIMIT 1").bind(user.id).first();
    }
    if (!team) {
      const workspaceId = crypto.randomUUID();
      const teamId = crypto.randomUUID();
      await env.JDM_DB.batch([
        env.JDM_DB.prepare('INSERT INTO workspaces(id,name) VALUES(?,?)').bind(workspaceId, `Espacio de ${pilot.name}`),
        env.JDM_DB.prepare("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(?,?,'owner')").bind(workspaceId, user.id),
        env.JDM_DB.prepare('INSERT INTO teams(id,workspace_id,name,pilot_slug) VALUES(?,?,?,?)').bind(teamId, workspaceId, pilot.name, pilot.slug)
      ]);
      team = { id: teamId, workspace_id: workspaceId };
    } else {
      await env.JDM_DB.prepare('UPDATE teams SET name=?,pilot_slug=? WHERE id=?').bind(pilot.name, pilot.slug, team.id).run();
    }
    await env.JDM_DB.batch([
      env.JDM_DB.prepare("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(?,?,'owner') ON CONFLICT(workspace_id,user_id) DO UPDATE SET role='owner'").bind(team.workspace_id, user.id),
      env.JDM_DB.prepare("INSERT INTO team_members(team_id,user_id,role,status) VALUES(?,?,'manager','active') ON CONFLICT(team_id,user_id) DO UPDATE SET role='manager',status='active'").bind(team.id, user.id),
      env.JDM_DB.prepare("INSERT INTO team_member_roles(team_id,user_id,role) VALUES(?,?,'manager') ON CONFLICT(team_id,user_id,role) DO NOTHING").bind(team.id, user.id),
      env.JDM_DB.prepare("INSERT INTO team_subscriptions(team_id,plan,status,billing_owner_user_id,updated_at) VALUES(?,'pilot','active',?,CURRENT_TIMESTAMP) ON CONFLICT(team_id) DO UPDATE SET plan='pilot',status='active',billing_owner_user_id=excluded.billing_owner_user_id,updated_at=CURRENT_TIMESTAMP").bind(team.id, user.id)
    ]);
    await subscribeAssignedTeam(env, user.id, team.id);
    results.push({ team: pilot.name, email, teamId: team.id, state: 'ready' });
  }
  return json({ pilots: results });
}

async function refresh(env) {
  const results = [];
  for (const team of await allFollowed(env)) {
    try {
      const current = await fetchTeam(team);
      const stored = await env.JDM_DB.prepare('SELECT payload FROM jdm_snapshots WHERE slug=?').bind(team.slug).first();
      const updates = changes(stored ? JSON.parse(stored.payload) : null, current);
      const checkedAt = new Date().toISOString();
      await env.JDM_DB.prepare('INSERT INTO jdm_snapshots(slug,payload,checked_at) VALUES(?,?,?) ON CONFLICT(slug) DO UPDATE SET payload=excluded.payload,checked_at=excluded.checked_at').bind(team.slug, JSON.stringify(current), checkedAt).run();
      for (const update of updates) await env.JDM_DB.prepare('INSERT INTO jdm_events(slug,match_id,before_json,after_json,created_at) VALUES(?,?,?,?,?)').bind(team.slug, update.matchId, JSON.stringify(update.before), JSON.stringify(update.after), checkedAt).run();
      results.push({ slug: team.slug, state: current.state, changes: updates.length });
    } catch (error) { results.push({ slug: team.slug, error: String(error) }); }
  }
  return results;
}

async function authenticatedApi(request, env, ctx, url) {
  const claims = await authenticate(request, env);
  const account = await ensureAccount(env, claims);
  if (url.pathname === '/api/me' && request.method === 'GET') {
    await subscribeAssignedTeams(env, account.userId);
    const teams = await env.JDM_DB.prepare("SELECT t.id,t.name,t.sport,t.workspace_id,w.name workspace_name,tm.role legacy_role FROM teams t JOIN team_members tm ON tm.team_id=t.id JOIN workspaces w ON w.id=t.workspace_id LEFT JOIN team_subscriptions ts ON ts.team_id=t.id WHERE tm.user_id=? AND tm.status=? AND NOT (t.name='Mi equipo' AND t.external_team_slug IS NULL AND COALESCE(ts.plan,'free')='free' AND COALESCE(ts.status,'inactive')='inactive') ORDER BY t.created_at").bind(account.userId, 'active').all();
    const roleRows = await env.JDM_DB.prepare('SELECT team_id,role FROM team_member_roles WHERE user_id=?').bind(account.userId).all();
    const rolesByTeam = new Map();
    for (const row of roleRows.results) rolesByTeam.set(row.team_id, [...(rolesByTeam.get(row.team_id) || []), row.role]);
    const workspace = account.workspace || (teams.results[0] ? { id: teams.results[0].workspace_id, name: teams.results[0].workspace_name } : null);
    return json({ user: { id: account.userId, name: claimName(claims), email: claims.email || null }, workspace, teams: teams.results.map(({ workspace_id, workspace_name, legacy_role, ...team }) => {
      const roles = rolesByTeam.get(team.id) || [legacy_role];
      return { ...team, role: primaryRole(roles), roles, workspace: { id: workspace_id, name: workspace_name } };
    }) });
  }
  const inviteAccept = url.pathname.match(/^\/api\/invites\/([^/]+)\/accept$/);
  if (inviteAccept && request.method === 'POST') {
    const tokenHash = await hashToken(decodeURIComponent(inviteAccept[1]));
    const invitation = await env.JDM_DB.prepare('SELECT * FROM team_invites WHERE token_hash=?').bind(tokenHash).first();
    if (!invitation || invitation.revoked_at || invitation.expires_at <= new Date().toISOString() || invitation.use_count >= invitation.max_uses) return json({ error: 'La invitación no existe, ha caducado o ya se ha utilizado.' }, 410);
    if (invitation.intended_email && invitation.intended_email !== String(claims.email || '').toLowerCase()) return json({ error: 'Esta invitación pertenece a otra dirección de correo.' }, 403);
    const existingRole = await env.JDM_DB.prepare('SELECT 1 ok FROM team_member_roles WHERE team_id=? AND user_id=? AND role=?').bind(invitation.team_id, account.userId, invitation.role).first();
    if (existingRole) return json({ error: 'Ya tienes este rol en el equipo.', role: invitation.role }, 409);
    const consumed = await env.JDM_DB.prepare('UPDATE team_invites SET use_count=use_count+1 WHERE id=? AND revoked_at IS NULL AND expires_at>? AND use_count<max_uses').bind(invitation.id, new Date().toISOString()).run();
    if (consumed.meta?.changes !== 1) return json({ error: 'La invitación ya no está disponible.' }, 410);
    const invitedTeam = await env.JDM_DB.prepare('SELECT workspace_id FROM teams WHERE id=?').bind(invitation.team_id).first();
    if (!invitedTeam) return json({ error: 'El equipo de la invitación ya no existe.' }, 410);
    await env.JDM_DB.batch([
      env.JDM_DB.prepare("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(?,?,'member') ON CONFLICT(workspace_id,user_id) DO NOTHING").bind(invitedTeam.workspace_id, account.userId),
      env.JDM_DB.prepare("INSERT INTO team_members(team_id,user_id,role,status) VALUES(?,?,?,'active') ON CONFLICT(team_id,user_id) DO UPDATE SET role=CASE WHEN team_members.role='manager' OR excluded.role='manager' THEN 'manager' WHEN team_members.role='delegate' OR excluded.role='delegate' THEN 'delegate' ELSE 'player' END,status='active'").bind(invitation.team_id, account.userId, invitation.role),
      env.JDM_DB.prepare('INSERT INTO team_member_roles(team_id,user_id,role) VALUES(?,?,?)').bind(invitation.team_id, account.userId, invitation.role)
    ]);
    if (invitation.role === 'player') await env.JDM_DB.prepare('INSERT INTO roster_players(id,team_id,user_id,display_name) VALUES(?,?,?,?) ON CONFLICT(team_id,user_id) DO UPDATE SET status=?').bind(crypto.randomUUID(), invitation.team_id, account.userId, claimName(claims), 'active').run();
    await subscribeAssignedTeam(env, account.userId, invitation.team_id);
    return json({ joined: true, teamId: invitation.team_id, addedRole: invitation.role });
  }
  const accessMatch = url.pathname.match(/^\/api\/teams\/([^/]+)\/access$/);
  if (accessMatch && request.method === 'GET') {
    const access = await teamAccess(env, account.userId, decodeURIComponent(accessMatch[1]));
    if (!access) return json({ error: 'No perteneces al equipo.' }, 403);
    return json({ ...access, permissions: permissionsForRoles(access.roles), teamManagementEnabled: subscriptionAllows(access.subscription, 'team_management') });
  }
  const teamRoute = url.pathname.match(/^\/api\/teams\/([^/]+)\/(members|invites|roster|callups|lineup-options|matches|goals|source)$/);
  if (teamRoute) {
    const teamId = decodeURIComponent(teamRoute[1]);
    const resource = teamRoute[2];
    if (resource === 'members' && request.method === 'GET') {
      await requirePermission(env, account.userId, teamId, 'members.manage');
      const rows = await env.JDM_DB.prepare('SELECT tm.user_id,tm.role legacy_role,tm.status,u.display_name,u.email FROM team_members tm JOIN users u ON u.id=tm.user_id WHERE tm.team_id=? ORDER BY tm.role,u.display_name').bind(teamId).all();
      const roleRows = await env.JDM_DB.prepare('SELECT user_id,role FROM team_member_roles WHERE team_id=?').bind(teamId).all();
      const rolesByUser = new Map();
      for (const row of roleRows.results) rolesByUser.set(row.user_id, [...(rolesByUser.get(row.user_id) || []), row.role]);
      return json(rows.results.map(({ legacy_role, ...member }) => {
        const roles = rolesByUser.get(member.user_id) || [legacy_role];
        return { ...member, role: primaryRole(roles), roles };
      }));
    }
    if (resource === 'invites' && request.method === 'GET') {
      await requirePermission(env, account.userId, teamId, 'members.invite');
      const rows = await env.JDM_DB.prepare('SELECT id,role,mode,intended_email,max_uses,use_count,expires_at,created_at,revoked_at FROM team_invites WHERE team_id=? ORDER BY created_at DESC').bind(teamId).all();
      return json(rows.results);
    }
    if (resource === 'invites' && request.method === 'POST') {
      await requirePermission(env, account.userId, teamId, 'members.invite');
      let invite;
      try { invite = validateInvite(await request.json()); } catch (error) { return json({ error: error.message }, 400); }
      const token = encode(crypto.getRandomValues(new Uint8Array(32)));
      const id = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + invite.expiresInDays * 86400000).toISOString();
      await env.JDM_DB.prepare('INSERT INTO team_invites(id,team_id,token_hash,role,mode,intended_email,max_uses,expires_at,created_by) VALUES(?,?,?,?,?,?,?,?,?)').bind(id, teamId, await hashToken(token), invite.role, invite.mode, invite.email, invite.maxUses, expiresAt, account.userId).run();
      const frontendUrl = String(env.FRONTEND_URL || url.origin).replace(/\/$/, '');
      return json({ id, token, url: `${frontendUrl}/unirse/?token=${encodeURIComponent(token)}`, expiresAt, emailDelivery: invite.email ? 'pending-external-provider' : 'not-requested' }, 201);
    }
    if (resource === 'roster' && request.method === 'GET') {
      await requirePermission(env, account.userId, teamId, 'roster.manage');
      const rows = await env.JDM_DB.prepare('SELECT id,user_id,display_name,number,status FROM roster_players WHERE team_id=? ORDER BY number,display_name').bind(teamId).all();
      return json(rows.results);
    }
    if (resource === 'roster' && request.method === 'POST') {
      await requirePermission(env, account.userId, teamId, 'roster.manage');
      const body = await request.json();
      if (!String(body.displayName || '').trim()) return json({ error: 'El nombre del jugador es obligatorio.' }, 400);
      const player = { id: crypto.randomUUID(), name: String(body.displayName).trim(), number: body.number == null ? null : Number(body.number) };
      await env.JDM_DB.prepare('INSERT INTO roster_players(id,team_id,display_name,number) VALUES(?,?,?,?)').bind(player.id, teamId, player.name, player.number).run();
      return json(player, 201);
    }
    if (resource === 'lineup-options' && request.method === 'GET') {
      await requirePermission(env, account.userId, teamId, 'lineups.manage');
      const roster = await env.JDM_DB.prepare("SELECT id,user_id,display_name,number,status FROM roster_players WHERE team_id=? AND status='active' ORDER BY number,display_name").bind(teamId).all();
      const callups = await env.JDM_DB.prepare('SELECT id,match_id,title,starts_at,response_deadline FROM callups WHERE team_id=? AND cancelled_at IS NULL AND starts_at>=? ORDER BY starts_at').bind(teamId, new Date(Date.now() - 86400000).toISOString()).all();
      const callupPlayers = callups.results.length ? await env.JDM_DB.prepare(`SELECT cp.callup_id,rp.id,rp.user_id,rp.display_name,rp.number FROM callup_players cp JOIN roster_players rp ON rp.id=cp.roster_player_id WHERE cp.callup_id IN (${callups.results.map(() => '?').join(',')}) AND rp.status='active' ORDER BY rp.number,rp.display_name`).bind(...callups.results.map(callup => callup.id)).all() : { results: [] };
      const playersByCallup = new Map();
      for (const player of callupPlayers.results) playersByCallup.set(player.callup_id, [...(playersByCallup.get(player.callup_id) || []), { id: player.id, user_id: player.user_id, display_name: player.display_name, number: player.number }]);
      return json({ roster: roster.results, callups: callups.results.map(callup => ({ ...callup, players: playersByCallup.get(callup.id) || [] })) });
    }
    if (resource === 'callups' && request.method === 'GET') {
      const access = await teamAccess(env, account.userId, teamId);
      if (!access) return json({ error: 'No perteneces al equipo.' }, 403);
      const rows = await env.JDM_DB.prepare("SELECT c.id,c.match_id,c.title,c.starts_at,c.response_deadline,c.cancelled_at,COUNT(cp.roster_player_id) invited,SUM(cp.response='available') available,SUM(cp.response='unavailable') unavailable,(SELECT mine.response FROM callup_players mine JOIN roster_players rp ON rp.id=mine.roster_player_id WHERE mine.callup_id=c.id AND rp.user_id=? LIMIT 1) my_response FROM callups c LEFT JOIN callup_players cp ON cp.callup_id=c.id WHERE c.team_id=? GROUP BY c.id ORDER BY c.starts_at DESC").bind(account.userId, teamId).all();
      return json(rows.results);
    }
    if (resource === 'callups' && request.method === 'POST') {
      await requirePermission(env, account.userId, teamId, 'callups.manage');
      const body = await request.json();
      if (!String(body.title || '').trim() || Number.isNaN(Date.parse(body.startsAt))) return json({ error: 'Título y fecha de convocatoria son obligatorios.' }, 400);
      const id = crypto.randomUUID();
      await env.JDM_DB.prepare('INSERT INTO callups(id,team_id,match_id,title,starts_at,response_deadline,created_by) VALUES(?,?,?,?,?,?,?)').bind(id, teamId, body.matchId || null, String(body.title).trim(), new Date(body.startsAt).toISOString(), body.responseDeadline ? new Date(body.responseDeadline).toISOString() : null, account.userId).run();
      const playerIds = Array.isArray(body.playerIds) ? [...new Set(body.playerIds.map(String))] : [];
      if (playerIds.length) await env.JDM_DB.batch(playerIds.map(playerId => env.JDM_DB.prepare('INSERT INTO callup_players(callup_id,roster_player_id) SELECT ?,id FROM roster_players WHERE id=? AND team_id=? AND status=?').bind(id, playerId, teamId, 'active')));
      return json({ id }, 201);
    }
    if (resource === 'source' && request.method === 'PATCH') {
      await requirePermission(env, account.userId, teamId, 'team.manage');
      const body = await request.json();
      if (![body.slug, body.teamCode, body.groupCode].every(value => typeof value === 'string' && value)) return json({ error: 'La vinculación oficial no es válida.' }, 400);
      await env.JDM_DB.prepare('UPDATE teams SET external_team_slug=?,external_team_code=?,external_group_code=? WHERE id=?').bind(body.slug, body.teamCode, body.groupCode, teamId).run();
      await subscribeAllTeamMembers(env, teamId);
      return json({ linked: true });
    }
    if (resource === 'matches' && request.method === 'GET') {
      await requirePermission(env, account.userId, teamId, 'goals.record');
      const team = await env.JDM_DB.prepare('SELECT external_team_slug FROM teams WHERE id=?').bind(teamId).first();
      const snapshot = team?.external_team_slug ? await env.JDM_DB.prepare('SELECT payload FROM jdm_snapshots WHERE slug=?').bind(team.external_team_slug).first() : null;
      const matches = snapshot ? (JSON.parse(snapshot.payload).fixtures || []).filter(item => item.status === 'F') : [];
      const goals = await env.JDM_DB.prepare('SELECT g.id,g.match_id,g.minute,g.created_at,r.display_name player_name FROM match_goals g JOIN roster_players r ON r.id=g.roster_player_id WHERE g.team_id=? ORDER BY g.created_at DESC').bind(teamId).all();
      return json({ matches, goals: goals.results });
    }
    if (resource === 'goals' && request.method === 'POST') {
      await requirePermission(env, account.userId, teamId, 'goals.record');
      const body = await request.json();
      const team = await env.JDM_DB.prepare('SELECT external_team_slug FROM teams WHERE id=?').bind(teamId).first();
      const snapshot = team?.external_team_slug ? await env.JDM_DB.prepare('SELECT payload FROM jdm_snapshots WHERE slug=?').bind(team.external_team_slug).first() : null;
      const match = snapshot && JSON.parse(snapshot.payload).fixtures?.find(item => item.id === body.matchId);
      if (!match || match.status !== 'F') return json({ error: 'Los goleadores sólo pueden registrarse cuando el resultado oficial sea definitivo.' }, 409);
      const player = await env.JDM_DB.prepare('SELECT id FROM roster_players WHERE id=? AND team_id=? AND status=?').bind(body.rosterPlayerId, teamId, 'active').first();
      if (!player) return json({ error: 'El goleador no pertenece a la plantilla activa.' }, 400);
      const id = crypto.randomUUID();
      await env.JDM_DB.prepare('INSERT INTO match_goals(id,team_id,match_id,roster_player_id,minute,created_by) VALUES(?,?,?,?,?,?)').bind(id, teamId, body.matchId, player.id, body.minute == null ? null : Number(body.minute), account.userId).run();
      return json({ id }, 201);
    }
  }
  const rosterCandidates = url.pathname.match(/^\/api\/teams\/([^/]+)\/roster\/candidates$/);
  if (rosterCandidates && request.method === 'GET') {
    const teamId = decodeURIComponent(rosterCandidates[1]);
    await requirePermission(env, account.userId, teamId, 'roster.manage');
    const rows = await env.JDM_DB.prepare("SELECT tm.user_id,u.display_name,u.email,GROUP_CONCAT(r.role) roles,rp.id linked_roster_id,rp.display_name linked_player_name FROM team_members tm JOIN users u ON u.id=tm.user_id LEFT JOIN team_member_roles r ON r.team_id=tm.team_id AND r.user_id=tm.user_id LEFT JOIN roster_players rp ON rp.team_id=tm.team_id AND rp.user_id=tm.user_id WHERE tm.team_id=? AND tm.status='active' GROUP BY tm.user_id,u.display_name,u.email,rp.id,rp.display_name ORDER BY u.display_name").bind(teamId).all();
    return json(rows.results.map(row => ({ ...row, roles: String(row.roles || '').split(',').filter(Boolean) })));
  }
  const rosterLink = url.pathname.match(/^\/api\/teams\/([^/]+)\/roster\/([^/]+)\/link$/);
  if (rosterLink && request.method === 'PATCH') {
    const teamId = decodeURIComponent(rosterLink[1]);
    const playerId = decodeURIComponent(rosterLink[2]);
    await requirePermission(env, account.userId, teamId, 'roster.manage');
    const body = await request.json();
    const userId = String(body.userId || '');
    const player = await env.JDM_DB.prepare('SELECT id,user_id FROM roster_players WHERE id=? AND team_id=?').bind(playerId, teamId).first();
    if (!player) return json({ error: 'La ficha de jugador no existe.' }, 404);
    if (player.user_id) return json({ error: 'Esta ficha ya está vinculada a una cuenta.' }, 409);
    const member = await env.JDM_DB.prepare("SELECT 1 ok FROM team_members WHERE team_id=? AND user_id=? AND status='active'").bind(teamId, userId).first();
    if (!member) return json({ error: 'La cuenta no pertenece a este equipo.' }, 400);
    const duplicate = await env.JDM_DB.prepare('SELECT id FROM roster_players WHERE team_id=? AND user_id=?').bind(teamId, userId).first();
    const statements = [];
    if (duplicate && duplicate.id !== playerId) statements.push(
      env.JDM_DB.prepare('DELETE FROM callup_players WHERE roster_player_id=? AND callup_id IN (SELECT callup_id FROM callup_players WHERE roster_player_id=?)').bind(playerId, duplicate.id),
      env.JDM_DB.prepare('UPDATE callup_players SET roster_player_id=? WHERE roster_player_id=?').bind(playerId, duplicate.id),
      env.JDM_DB.prepare('UPDATE match_goals SET roster_player_id=? WHERE roster_player_id=?').bind(playerId, duplicate.id),
      env.JDM_DB.prepare('DELETE FROM roster_players WHERE id=?').bind(duplicate.id)
    );
    statements.push(
      env.JDM_DB.prepare('UPDATE roster_players SET user_id=?,status=? WHERE id=? AND team_id=?').bind(userId, 'active', playerId, teamId),
      env.JDM_DB.prepare("INSERT OR IGNORE INTO team_member_roles(team_id,user_id,role) VALUES(?,?,'player')").bind(teamId, userId),
      env.JDM_DB.prepare("UPDATE team_members SET role=CASE WHEN role='manager' THEN 'manager' WHEN role='delegate' THEN 'delegate' ELSE 'player' END,status='active' WHERE team_id=? AND user_id=?").bind(teamId, userId)
    );
    await env.JDM_DB.batch(statements);
    return json({ linked: true, mergedRosterId: duplicate?.id || null });
  }
  const memberRole = url.pathname.match(/^\/api\/teams\/([^/]+)\/members\/([^/]+)\/roles\/([^/]+)$/);
  if (memberRole && request.method === 'DELETE') {
    const teamId = decodeURIComponent(memberRole[1]);
    const userId = decodeURIComponent(memberRole[2]);
    const role = decodeURIComponent(memberRole[3]);
    await requirePermission(env, account.userId, teamId, 'members.manage');
    if (!['manager', 'delegate', 'player'].includes(role)) return json({ error: 'Rol no válido.' }, 400);
    const existing = await env.JDM_DB.prepare('SELECT 1 ok FROM team_member_roles WHERE team_id=? AND user_id=? AND role=?').bind(teamId, userId, role).first();
    if (!existing) return json({ error: 'La persona no tiene ese rol.' }, 404);
    if (role === 'manager' && await isLastActiveManager(env, teamId, userId)) return json({ error: 'El equipo debe conservar al menos un mánager.' }, 409);
    await env.JDM_DB.prepare('DELETE FROM team_member_roles WHERE team_id=? AND user_id=? AND role=?').bind(teamId, userId, role).run();
    if (role === 'player') await env.JDM_DB.prepare('UPDATE roster_players SET user_id=NULL WHERE team_id=? AND user_id=?').bind(teamId, userId).run();
    const remaining = await env.JDM_DB.prepare('SELECT role FROM team_member_roles WHERE team_id=? AND user_id=?').bind(teamId, userId).all();
    if (!remaining.results.length) {
      await env.JDM_DB.prepare('DELETE FROM team_members WHERE team_id=? AND user_id=?').bind(teamId, userId).run();
      await cleanupWorkspaceMembership(env, teamId, userId);
      return json({ removed: true, accessRemoved: true, roles: [] });
    }
    const roles = remaining.results.map(item => item.role);
    await env.JDM_DB.prepare('UPDATE team_members SET role=? WHERE team_id=? AND user_id=?').bind(primaryRole(roles), teamId, userId).run();
    return json({ removed: true, accessRemoved: false, roles });
  }
  const memberAccess = url.pathname.match(/^\/api\/teams\/([^/]+)\/members\/([^/]+)$/);
  if (memberAccess && request.method === 'DELETE') {
    const teamId = decodeURIComponent(memberAccess[1]);
    const userId = decodeURIComponent(memberAccess[2]);
    await requirePermission(env, account.userId, teamId, 'members.manage');
    const member = await env.JDM_DB.prepare('SELECT 1 ok FROM team_members WHERE team_id=? AND user_id=?').bind(teamId, userId).first();
    if (!member) return json({ error: 'La persona no pertenece al equipo.' }, 404);
    if (await isLastActiveManager(env, teamId, userId)) return json({ error: 'El equipo debe conservar al menos un mánager.' }, 409);
    await env.JDM_DB.batch([
      env.JDM_DB.prepare('UPDATE roster_players SET user_id=NULL WHERE team_id=? AND user_id=?').bind(teamId, userId),
      env.JDM_DB.prepare('DELETE FROM team_members WHERE team_id=? AND user_id=?').bind(teamId, userId)
    ]);
    await cleanupWorkspaceMembership(env, teamId, userId);
    return json({ removed: true });
  }
  const responseMatch = url.pathname.match(/^\/api\/callups\/([^/]+)\/respond$/);
  if (responseMatch && request.method === 'POST') {
    const callup = await env.JDM_DB.prepare('SELECT id,team_id,response_deadline FROM callups WHERE id=? AND cancelled_at IS NULL').bind(decodeURIComponent(responseMatch[1])).first();
    if (!callup) return json({ error: 'Convocatoria no encontrada.' }, 404);
    await requirePermission(env, account.userId, callup.team_id, 'callups.respond');
    if (callup.response_deadline && callup.response_deadline < new Date().toISOString()) return json({ error: 'El plazo de respuesta ha finalizado.' }, 409);
    const body = await request.json();
    if (!['available', 'unavailable'].includes(body.response)) return json({ error: 'Respuesta inválida.' }, 400);
    const player = await env.JDM_DB.prepare('SELECT id FROM roster_players WHERE team_id=? AND user_id=? AND status=?').bind(callup.team_id, account.userId, 'active').first();
    if (!player) return json({ error: 'Tu cuenta no está vinculada a un jugador de la plantilla.' }, 409);
    const updated = await env.JDM_DB.prepare('UPDATE callup_players SET response=?,responded_at=? WHERE callup_id=? AND roster_player_id=?').bind(body.response, new Date().toISOString(), callup.id, player.id).run();
    if (updated.meta?.changes !== 1) return json({ error: 'No estás incluido en esta convocatoria.' }, 403);
    return json({ response: body.response });
  }
  const revokeInvite = url.pathname.match(/^\/api\/teams\/([^/]+)\/invites\/([^/]+)$/);
  if (revokeInvite && request.method === 'DELETE') {
    const teamId = decodeURIComponent(revokeInvite[1]);
    await requirePermission(env, account.userId, teamId, 'members.invite');
    await env.JDM_DB.prepare('UPDATE team_invites SET revoked_at=? WHERE id=? AND team_id=? AND revoked_at IS NULL').bind(new Date().toISOString(), decodeURIComponent(revokeInvite[2]), teamId).run();
    return json({ revoked: true });
  }
  if (url.pathname === '/api/jdm/search' && request.method === 'GET') return json(await searchTeams({ query: url.searchParams.get('q'), league: url.searchParams.get('league'), district: url.searchParams.get('district') }));
  if (url.pathname === '/api/jdm/follows' && request.method === 'POST') {
    const body = await request.json();
    if (![body.slug, body.name, body.teamCode, body.groupCode].every(value => typeof value === 'string' && value)) return json({ error: 'Equipo inválido' }, 400);
    await env.JDM_DB.prepare('INSERT INTO user_follows(user_id,slug,name,team_code,group_code) VALUES(?,?,?,?,?) ON CONFLICT(user_id,slug) DO NOTHING').bind(account.userId, body.slug, body.name, body.teamCode, body.groupCode).run();
    const matchingTeams = await env.JDM_DB.prepare("SELECT t.id FROM teams t JOIN team_members tm ON tm.team_id=t.id WHERE tm.user_id=? AND tm.status='active' AND lower(t.name)=lower(?)").bind(account.userId, body.name).all();
    for (const team of matchingTeams.results) {
      const access = await teamAccess(env, account.userId, team.id);
      if (!hasPermission(access?.roles || [], 'team.manage')) continue;
      await env.JDM_DB.prepare('UPDATE teams SET external_team_slug=?,external_team_code=?,external_group_code=? WHERE id=?').bind(body.slug, body.teamCode, body.groupCode, team.id).run();
      await subscribeAllTeamMembers(env, team.id);
    }
    ctx.waitUntil(refresh(env));
    return json({ followed: true }, 201);
  }
  const follow = url.pathname.match(/^\/api\/jdm\/follows\/([^/]+)$/);
  if (follow && request.method === 'DELETE') {
    const assigned = await env.JDM_DB.prepare("SELECT 1 ok FROM team_members tm JOIN teams t ON t.id=tm.team_id WHERE tm.user_id=? AND tm.status='active' AND t.external_team_slug=? LIMIT 1").bind(account.userId, decodeURIComponent(follow[1])).first();
    if (assigned) return json({ error: 'El seguimiento está incluido por tu pertenencia al equipo.' }, 409);
    await env.JDM_DB.prepare('DELETE FROM user_follows WHERE user_id=? AND slug=?').bind(account.userId, decodeURIComponent(follow[1])).run();
    return json({ followed: false });
  }
  if (url.pathname === '/api/jdm/teams' && request.method === 'GET') {
    const rows = await env.JDM_DB.prepare("SELECT f.slug,f.name,s.payload,s.checked_at,EXISTS(SELECT 1 FROM team_members tm JOIN teams t ON t.id=tm.team_id WHERE tm.user_id=f.user_id AND tm.status='active' AND t.external_team_slug=f.slug) managed_by_team FROM user_follows f LEFT JOIN jdm_snapshots s ON s.slug=f.slug WHERE f.user_id=? ORDER BY f.name").bind(account.userId).all();
    return json(rows.results.map(row => row.payload ? { ...JSON.parse(row.payload), checkedAt: row.checked_at, followed: true, managedByTeam: Boolean(row.managed_by_team) } : { slug: row.slug, name: row.name, state: 'pending', fixtures: [], standings: [], followed: true, managedByTeam: Boolean(row.managed_by_team) }));
  }
  if (url.pathname === '/api/jdm/events' && request.method === 'GET') {
    const slug = url.searchParams.get('slug');
    const since = Number(url.searchParams.get('since') || 0);
    const followed = await env.JDM_DB.prepare('SELECT 1 ok FROM user_follows WHERE user_id=? AND slug=?').bind(account.userId, slug).first();
    if (!followed || !Number.isSafeInteger(since) || since < 0) return json({ error: 'Parámetros inválidos' }, 400);
    const rows = await env.JDM_DB.prepare('SELECT id,match_id,before_json,after_json,created_at FROM jdm_events WHERE slug=? AND id>? ORDER BY id LIMIT 100').bind(slug, since).all();
    return json(rows.results.map(row => ({ id: row.id, matchId: row.match_id, before: JSON.parse(row.before_json), after: JSON.parse(row.after_json), createdAt: row.created_at })));
  }
  return json({ error: 'No encontrado' }, 404);
}

export default {
  async scheduled(_event, env, ctx) { ctx.waitUntil(refresh(env)); },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return json({ error: 'No encontrado' }, 404);
    if (request.method === 'OPTIONS') {
      const status = allowedOrigin(request, env) ? 204 : 403;
      return withCors(new Response(null, { status }), request, env);
    }
    let response;
    try {
      if (url.pathname === '/api/admin/pilots' && request.method === 'POST') response = await provisionPilots(request, env);
      else if (url.pathname === '/api/jdm/refresh' && request.method === 'POST' && env.JDM_REFRESH_TOKEN && request.headers.get('authorization') === `Bearer ${env.JDM_REFRESH_TOKEN}`) response = json(await refresh(env));
      else {
        const invitation = url.pathname.match(/^\/api\/invites\/([^/]+)$/);
        if (invitation && request.method === 'GET') {
          const summary = await inspectInvite(env, decodeURIComponent(invitation[1]));
          response = summary ? json(summary, summary.valid ? 200 : 410) : json({ error: 'Invitación no encontrada.' }, 404);
        } else response = await authenticatedApi(request, env, ctx, url);
      }
    } catch (error) {
      console.error('Worker request failed', { method: request.method, path: url.pathname, error: error instanceof Error ? error.stack || error.message : String(error) });
      response = error instanceof Response ? (error.status === 401 ? json({ error: 'No autorizado' }, 401) : error) : json({ error: 'Error interno' }, 500);
    }
    return withCors(response, request, env);
  }
};
