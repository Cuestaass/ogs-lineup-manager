import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearSession, getSession, onAuthStateChange } from './supabase.js';

const AuthContext = createContext(null);
const ACTIVE_TEAM_KEY = 'ogs-active-team-v1';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  window.__OGS_ACCESS_TOKEN__ = session?.accessToken || '';

  useEffect(() => {
    let active = true;
    getSession().then(value => { if (active) setSession(value); }).catch(reason => setError(reason.message)).finally(() => { if (active) setAuthLoading(false); });
    const unsubscribe = onAuthStateChange(value => { if (active) setSession(value); });
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      const returnTo = `${location.pathname}${location.search}`;
      location.replace(`/login/?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    if (session.accessToken === 'local-development') {
      import('../api/localApi.js').then(({ getLocalTeams }) => {
        const teams = getLocalTeams();
        setAccount({ user: session.profile, workspace: { id: 'pilot-workspace', name: 'Programa piloto' }, teams });
        const stored = localStorage.getItem(ACTIVE_TEAM_KEY);
        if (!teams.some(team => team.id === stored)) localStorage.setItem(ACTIVE_TEAM_KEY, teams[0].id);
      }).catch(reason => setError(reason.message)).finally(() => setLoading(false));
      return;
    }
    api('/api/me').then(async response => {
      if (!response.ok) throw new Error('No se pudo abrir tu espacio de equipo.');
      const value = await response.json();
      setAccount(value);
      const stored = localStorage.getItem(ACTIVE_TEAM_KEY);
      const team = value.teams.find(item => item.id === stored) || value.teams[0];
      if (team) localStorage.setItem(ACTIVE_TEAM_KEY, team.id);
    }).catch(reason => setError(reason.message)).finally(() => setLoading(false));
  }, [session, authLoading]);

  const value = useMemo(() => ({
    session,
    account,
    activeTeam: account?.teams.find(team => team.id === localStorage.getItem(ACTIVE_TEAM_KEY)) || account?.teams[0] || null,
    selectTeam(teamId) {
      localStorage.setItem(ACTIVE_TEAM_KEY, teamId);
      location.reload();
    },
    async logout() {
      await clearSession();
      location.replace('/login/');
    }
  }), [session, account]);

  if (authLoading || loading) return <main className="session-state"><p>Abriendo tu espacio de equipo…</p></main>;
  if (error) return <main className="session-state"><h1>No se pudo abrir la aplicación</h1><p>{error}</p><a className="header-link" href="/login/">Volver a acceder</a></main>;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
