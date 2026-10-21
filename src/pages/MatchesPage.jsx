import React from 'react';
import source from '../../public/jdm/index.html?raw';
import { bodyMarkup } from '../lib/legacyMarkup.js';
import { MatchRecords } from '../components/MatchRecords.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';
import { LegacyPage } from '../components/LegacyPage.jsx';

const markup = bodyMarkup(source).replace('<section class="panel jdm-panel">', '<div data-page-content></div><section class="panel jdm-panel">');
const load = () => import('../../public/jdm.js');
export default function MatchesPage() {
  const { activeTeam } = useAuth();
  return <LegacyPage page="jdm" markup={markup} loadController={load}><MatchRecords key={activeTeam?.id} team={activeTeam}/></LegacyPage>;
}
