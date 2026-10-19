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

export function loadState() {
    try {
      let serialized = localStorage.getItem(storageKey());
      const migratingTeam = !serialized && activeTeamId().startsWith('local-') ? Number(activeTeamId().slice(6)) : null;
      if (!serialized && activeTeamId().startsWith('local')) serialized = localStorage.getItem(LEGACY_STORAGE_KEY);
      const parsed = JSON.parse(serialized);
      if (!parsed || !Array.isArray(parsed.teams) || !parsed.teams.length || !Array.isArray(parsed.players)) return defaultState();
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
        team.naturalSubs = team.naturalSubs
          .filter(pair => pair && Number.isFinite(Number(pair.starterId)) && Number.isFinite(Number(pair.substituteId)))
          .map(pair => ({ starterId: Number(pair.starterId), substituteId: Number(pair.substituteId) }));
      });
      return parsed;
    } catch {
      return defaultState();
    }
  }

export function saveState(state) {
  localStorage.setItem(storageKey(), JSON.stringify(state));
  if (activeTeamId() === 'local') localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(state));
}

