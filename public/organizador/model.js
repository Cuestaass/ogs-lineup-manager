const LEGACY_STORAGE_KEY = 'fc-ogs-organizer-v1';
const activeTeamId = () => globalThis.__OGS_TEAM__?.id || 'local';
const storageKey = () => `ogs-organizer-v2:${activeTeamId()}`;

export const formations = {
    '321': [
      { x: 50, y: 88, role: 'POR' },
      { x: 20, y: 68, role: 'DEF' },
      { x: 50, y: 65, role: 'DEF' },
      { x: 80, y: 68, role: 'DEF' },
      { x: 32, y: 40, role: 'MED' },
      { x: 68, y: 40, role: 'MED' },
      { x: 50, y: 17, role: 'DEL' }
    ],
    '231': [
      { x: 50, y: 88, role: 'POR' },
      { x: 30, y: 68, role: 'DEF' },
      { x: 70, y: 68, role: 'DEF' },
      { x: 18, y: 42, role: 'MED' },
      { x: 50, y: 38, role: 'MED' },
      { x: 82, y: 42, role: 'MED' },
      { x: 50, y: 17, role: 'DEL' }
    ],
    '222': [
      { x: 50, y: 88, role: 'POR' },
      { x: 30, y: 68, role: 'DEF' },
      { x: 70, y: 68, role: 'DEF' },
      { x: 30, y: 43, role: 'MED' },
      { x: 70, y: 43, role: 'MED' },
      { x: 32, y: 18, role: 'DEL' },
      { x: 68, y: 18, role: 'DEL' }
    ],
    '132': [
      { x: 50, y: 88, role: 'POR' },
      { x: 50, y: 68, role: 'DEF' },
      { x: 18, y: 43, role: 'MED' },
      { x: 50, y: 39, role: 'MED' },
      { x: 82, y: 43, role: 'MED' },
      { x: 32, y: 18, role: 'DEL' },
      { x: 68, y: 18, role: 'DEL' }
    ],
    '312': [
      { x: 50, y: 88, role: 'POR' },
      { x: 20, y: 68, role: 'DEF' },
      { x: 50, y: 65, role: 'DEF' },
      { x: 80, y: 68, role: 'DEF' },
      { x: 50, y: 41, role: 'MED' },
      { x: 32, y: 18, role: 'DEL' },
      { x: 68, y: 18, role: 'DEL' }
    ]
  };

export const defaultState = () => ({
    nextTeamId: 2,
    nextPlayerId: 1,
    teams: [{ id: 1, name: globalThis.__OGS_TEAM__?.name || 'Mi equipo', formation: '321', lineup: Array(7).fill(null), naturalSubs: [] }],
    players: []
  });

const normalizeName = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

export function syncRosterPlayers(state, roster, teamId = state.teams[0]?.id) {
  if (!teamId) return state;
  const sourceIds = new Set(roster.map(player => String(player.id)));
  const staleIds = new Set(state.players.filter(player => player.origin === 'roster' && !sourceIds.has(String(player.sourceId))).map(player => player.id));
  state.players = state.players.filter(player => !staleIds.has(player.id));
  for (const team of state.teams) {
    team.lineup = team.lineup.map(id => staleIds.has(id) ? null : id);
    team.naturalSubs = team.naturalSubs.filter(pair => !staleIds.has(pair.starterId) && !staleIds.has(pair.substituteId));
  }
  for (const source of roster) {
    const sourceId = String(source.id);
    let player = state.players.find(item => item.origin === 'roster' && String(item.sourceId) === sourceId);
    if (!player) {
      const legacyMatches = state.players.filter(item => item.origin !== 'roster' && normalizeName(item.name) === normalizeName(source.display_name));
      player = legacyMatches.length === 1 ? legacyMatches[0] : null;
    }
    if (!player) {
      player = { id: state.nextPlayerId++, name: source.display_name, number: source.number || null, teamIds: [teamId] };
      state.players.push(player);
    }
    player.origin = 'roster';
    player.sourceId = sourceId;
    player.name = source.display_name;
    player.number = source.number || player.number || null;
    if (!player.teamIds.includes(teamId)) player.teamIds.push(teamId);
  }
  return state;
}

export function applyCallupToTeam(state, teamId, callup = null) {
  const team = state.teams.find(item => item.id === Number(teamId));
  if (!team) return state;
  team.callupId = callup?.id || null;
  team.callupRosterIds = callup ? (callup.players || []).map(player => String(player.id)) : null;
  const eligibleIds = new Set(eligibleTeamPlayers(state, team.id).map(player => player.id));
  team.lineup = team.lineup.map(id => eligibleIds.has(id) ? id : null);
  team.naturalSubs = team.naturalSubs.filter(pair => eligibleIds.has(pair.starterId) && eligibleIds.has(pair.substituteId));
  return state;
}

export function eligibleTeamPlayers(state, teamId) {
  const id = Number(teamId);
  const team = state.teams.find(item => item.id === id);
  const selectedRoster = Array.isArray(team?.callupRosterIds) ? new Set(team.callupRosterIds.map(String)) : null;
  return state.players.filter(player => player.teamIds.includes(id) && (!selectedRoster || player.origin !== 'roster' || selectedRoster.has(String(player.sourceId))));
}

export function loadState({ onError = () => {}, onRestore = () => {} } = {}) {
    try {
      let serialized = localStorage.getItem(storageKey());
      const migratingTeam = !serialized && activeTeamId().startsWith('local-') ? Number(activeTeamId().slice(6)) : null;
      if (!serialized && activeTeamId().startsWith('local')) serialized = localStorage.getItem(LEGACY_STORAGE_KEY);
      const parsed = JSON.parse(serialized);
      if (!serialized) return defaultState();
      if (!parsed || !Array.isArray(parsed.teams) || !parsed.teams.length || !Array.isArray(parsed.players)) throw new Error('Invalid saved lineup');
      if (migratingTeam) {
        const team = parsed.teams.find(item => item.id === migratingTeam);
        if (!team) return defaultState();
        parsed.teams = [team];
        parsed.players = parsed.players.filter(player => player.teamIds?.includes(migratingTeam)).map(player => ({ ...player, teamIds: [migratingTeam] }));
      }
      parsed.teams.forEach(team => {
        if (!Array.isArray(team.lineup)) team.lineup = Array(7).fill(null);
        team.lineup = [...team.lineup.slice(0, 7), ...Array(7).fill(null)].slice(0, 7);
        if (!formations[team.formation]) team.formation = '321';
        if (!Array.isArray(team.naturalSubs)) team.naturalSubs = [];
        team.callupId ||= null;
        if (!Array.isArray(team.callupRosterIds)) team.callupRosterIds = null;
        team.naturalSubs = team.naturalSubs
          .filter(pair => pair && Number.isFinite(Number(pair.starterId)) && Number.isFinite(Number(pair.substituteId)))
          .map(pair => ({ starterId: Number(pair.starterId), substituteId: Number(pair.substituteId) }));
      });
      parsed.players.forEach(player => {
        player.origin ||= 'temporary';
        if (player.sourceId != null) player.sourceId = String(player.sourceId);
      });
      onRestore();
      return parsed;
    } catch (error) {
      onError(error);
      return defaultState();
    }
  }

export function saveState(state, key = storageKey()) {
  localStorage.setItem(key, JSON.stringify(state));
  // The v2 record is authoritative; failure of the compatibility copy is harmless.
  if (key === 'ogs-organizer-v2:local') {
    try { localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(state)); } catch {}
  }
}

// Capture the team key once: a team picker must never redirect an outstanding write.
export function createLineupSaver({ write = saveState, onStatus = () => {}, key = storageKey() } = {}) {
  let pending = false;
  let savedSnapshot;
  return {
    get pending() { return pending; },
    save(state) {
      const snapshot = JSON.stringify(state);
      if (!pending && snapshot === savedSnapshot) return true;
      pending = true;
      onStatus('pending');
      try {
        write(state, key);
        savedSnapshot = snapshot;
        pending = false;
        onStatus('saved');
        return true;
      } catch {
        onStatus('error');
        return false;
      }
    }
  };
}

