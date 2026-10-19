import { PILOT_TEAMS as PILOTS } from '../../pilots.js';
import { ROLE_PERMISSIONS } from '../../access.js';

const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const currentPilot = () => PILOTS.find(pilot => pilot.slug === JSON.parse(sessionStorage.getItem('ogs-session-v1') || '{}').profile?.pilotSlug) || PILOTS[0];
const currentUser = () => JSON.parse(sessionStorage.getItem('ogs-session-v1') || '{}').profile || {};
const key = teamId => `ogs-local-team-api-v1:${teamId}`;

function initial(teamId) {
  const pilot = PILOTS.find(item => `pilot-${item.slug}` === teamId) || currentPilot();
  return {
    members: [{ user_id: `pilot-manager-${pilot.slug}`, role: 'manager', status: 'active', display_name: `Manager · ${pilot.name}`, email: `${pilot.slug}@piloto.local` }],
    invites: [], roster: [], callups: [],
    matches: [{ id: `${teamId}:pilot-final`, date: '10/10/2026', home: pilot.name, away: 'Rival piloto', status: 'F' }],
    goals: [], teamId
  };
}
function read(teamId) { try { return JSON.parse(localStorage.getItem(key(teamId))) || initial(teamId); } catch { return initial(teamId); } }
function write(teamId, value) { localStorage.setItem(key(teamId), JSON.stringify(value)); }

export async function localApi(path, options = {}) {
  const url = new URL(path, location.origin);
  const team = url.pathname.match(/^\/api\/teams\/([^/]+)\/(access|members|invites|roster|callups|matches|goals)$/);
  if (team) {
    const teamId = decodeURIComponent(team[1]);
    const resource = team[2];
    const state = read(teamId);
    const membership = state.members.find(member => member.user_id === currentUser().sub);
    const role = membership?.role || 'manager';
    if (resource === 'access') return json({ role, subscription: { plan: 'pilot', status: 'active' }, permissions: [...ROLE_PERMISSIONS[role]], teamManagementEnabled: true });
    if (options.method === 'POST') {
      const body = JSON.parse(options.body || '{}');
      if (resource === 'invites') {
        const invite = { id: crypto.randomUUID(), role: body.role, mode: body.mode, intended_email: body.email || null, max_uses: body.mode === 'single' ? 1 : Number(body.maxUses || 25), use_count: 0, expires_at: new Date(Date.now() + Number(body.expiresInDays || 7) * 86400000).toISOString(), created_at: new Date().toISOString() };
        invite.token = crypto.randomUUID(); state.invites.unshift(invite); write(teamId, state);
        return json({ ...invite, url: `${location.origin}/unirse/?token=${invite.token}`, emailDelivery: body.email ? 'pending-external-provider' : 'not-requested' }, 201);
      }
      if (resource === 'roster') {
        const player = { id: crypto.randomUUID(), user_id: null, display_name: body.displayName, number: body.number || null, status: 'active' };
        state.roster.push(player); write(teamId, state); return json(player, 201);
      }
      if (resource === 'callups') {
        const callup = { id: crypto.randomUUID(), title: body.title, starts_at: body.startsAt, response_deadline: body.responseDeadline || null, player_ids: body.playerIds || [], responses: {}, invited: body.playerIds?.length || 0, available: 0, unavailable: 0 };
        state.callups.unshift(callup); write(teamId, state); return json({ id: callup.id }, 201);
      }
      if (resource === 'goals') {
        const match = state.matches.find(item => item.id === body.matchId && item.status === 'F');
        const player = state.roster.find(item => item.id === body.rosterPlayerId);
        if (!match || !player) return json({ error: 'Partido o goleador no válido.' }, 400);
        const goal = { id: crypto.randomUUID(), match_id: match.id, roster_player_id: player.id, player_name: player.display_name, minute: body.minute == null || body.minute === '' ? null : Number(body.minute) };
        state.goals.unshift(goal); write(teamId, state); return json({ id: goal.id }, 201);
      }
    }
    if (resource === 'callups') {
      const player = state.roster.find(item => item.user_id === currentUser().sub);
      return json(state.callups.map(callup => ({ ...callup, my_response: player ? callup.responses?.[player.id] || null : null })));
    }
    if (resource === 'matches') return json({ matches: state.matches.filter(match => match.status === 'F'), goals: state.goals });
    return json(state[resource]);
  }
  const revoke = url.pathname.match(/^\/api\/teams\/([^/]+)\/invites\/([^/]+)$/);
  if (revoke && options.method === 'DELETE') {
    const state = read(decodeURIComponent(revoke[1]));
    const invite = state.invites.find(item => item.id === decodeURIComponent(revoke[2]));
    if (invite) invite.revoked_at = new Date().toISOString();
    write(decodeURIComponent(revoke[1]), state); return json({ revoked: true });
  }
  const invitation = url.pathname.match(/^\/api\/invites\/([^/]+)(\/accept)?$/);
  if (invitation) {
    for (const pilot of PILOTS) {
      const teamId = `pilot-${pilot.slug}`;
      const state = read(teamId);
      const invite = state.invites.find(item => item.token === decodeURIComponent(invitation[1]));
      if (!invite) continue;
      const valid = !invite.revoked_at && invite.use_count < invite.max_uses && invite.expires_at > new Date().toISOString();
      if (!invitation[2]) return json({ teamName: pilot.name, role: invite.role, mode: invite.mode, remainingUses: invite.max_uses - invite.use_count, expiresAt: invite.expires_at, valid }, valid ? 200 : 410);
      if (!valid) return json({ error: 'La invitación ya no está disponible.' }, 410);
      const profile = currentUser();
      if (!profile.sub) return json({ error: 'Debes identificarte antes de aceptar la invitación.' }, 401);
      if (!state.members.some(member => member.user_id === profile.sub)) state.members.push({ user_id: profile.sub, role: invite.role, status: 'active', display_name: profile.name || 'Usuario piloto', email: `${profile.pilotSlug || 'usuario'}@piloto.local` });
      if (invite.role === 'player' && !state.roster.some(player => player.user_id === profile.sub)) state.roster.push({ id: crypto.randomUUID(), user_id: profile.sub, display_name: profile.name || 'Jugador piloto', number: null, status: 'active' });
      invite.use_count += 1; write(teamId, state); return json({ joined: true, teamId, role: invite.role });
    }
    return json({ error: 'Invitación no encontrada.' }, 404);
  }
  const response = url.pathname.match(/^\/api\/callups\/([^/]+)\/respond$/);
  if (response && options.method === 'POST') {
    const body = JSON.parse(options.body || '{}');
    for (const pilot of PILOTS) {
      const teamId = `pilot-${pilot.slug}`;
      const state = read(teamId);
      const callup = state.callups.find(item => item.id === decodeURIComponent(response[1]));
      if (!callup) continue;
      const player = state.roster.find(item => item.user_id === currentUser().sub);
      if (!player || !callup.player_ids?.includes(player.id)) return json({ error: 'No estás incluido en esta convocatoria.' }, 403);
      callup.responses ||= {};
      callup.responses[player.id] = body.response;
      callup.available = Object.values(callup.responses).filter(value => value === 'available').length;
      callup.unavailable = Object.values(callup.responses).filter(value => value === 'unavailable').length;
      write(teamId, state);
      return json({ response: body.response });
    }
    return json({ error: 'Convocatoria no encontrada.' }, 404);
  }
  return json({ error: 'Ruta local no implementada.' }, 404);
}

export function getLocalTeams() {
  const userId = currentUser().sub;
  return PILOTS.flatMap(pilot => {
    const state = read(`pilot-${pilot.slug}`);
    const membership = state.members.find(member => member.user_id === userId && member.status === 'active');
    return membership ? [{ id: `pilot-${pilot.slug}`, name: pilot.name, role: membership.role }] : [];
  });
}

export { PILOTS };
