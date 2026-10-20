import React from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './auth/AuthProvider.jsx';
import OrganizerPage from './pages/OrganizerPage.jsx';
import TacticsPage from './pages/TacticsPage.jsx';
import MatchesPage from './pages/MatchesPage.jsx';
import TeamManagementPage from './pages/TeamManagementPage.jsx';
import JoinTeamPage from './pages/JoinTeamPage.jsx';
import { AppShell } from './components/AppShell.jsx';
import { useAuth } from './auth/AuthProvider.jsx';
import { canAccessPage } from '../access.js';
import '../public/styles.css';
import './react.css';

const page = document.body.dataset.page;
const Page = page === 'tactica' ? TacticsPage : page === 'jdm' ? MatchesPage : page === 'equipo' ? TeamManagementPage : OrganizerPage;

function AuthorizedPage() {
  const { activeTeam } = useAuth();
  if (canAccessPage(activeTeam?.roles || activeTeam?.role, page)) return <Page/>;
  const hasTeam = Boolean(activeTeam);
  return <AppShell page={page}>
    <header className="app-header access-header"><div><p className="eyebrow">ACCESO PERSONAL</p><h1>{hasTeam ? 'Esta sección no corresponde a tu rol' : 'Aún no perteneces a un equipo'}</h1><p>{hasTeam ? 'Tu navegación muestra únicamente las herramientas habilitadas para ti.' : 'Tu cuenta está lista. Un mánager debe invitarte o asignarte a un equipo.'}</p></div></header>
    <main id="main-content" className="access-empty"><section className="panel"><h2>{hasTeam ? 'Permisos limitados' : 'Esperando invitación'}</h2><p>{hasTeam ? 'Puedes seguir usando las secciones disponibles en el menú.' : 'Cuando aceptes una invitación, el equipo y las funciones correspondientes a tu rol aparecerán automáticamente.'}</p><a className="header-link" href="/jdm/">Ver partidos y clasificaciones</a></section></main>
  </AppShell>;
}

createRoot(document.getElementById('root')).render(page === 'unirse' ? <JoinTeamPage/> : <AuthProvider><AuthorizedPage/></AuthProvider>);
