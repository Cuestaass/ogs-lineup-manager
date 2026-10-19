import React from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './auth/AuthProvider.jsx';
import OrganizerPage from './pages/OrganizerPage.jsx';
import TacticsPage from './pages/TacticsPage.jsx';
import MatchesPage from './pages/MatchesPage.jsx';
import TeamManagementPage from './pages/TeamManagementPage.jsx';
import JoinTeamPage from './pages/JoinTeamPage.jsx';
import '../public/styles.css';
import './react.css';

const page = document.body.dataset.page;
const Page = page === 'tactica' ? TacticsPage : page === 'jdm' ? MatchesPage : page === 'equipo' ? TeamManagementPage : OrganizerPage;
createRoot(document.getElementById('root')).render(page === 'unirse' ? <JoinTeamPage/> : <AuthProvider><Page/></AuthProvider>);
