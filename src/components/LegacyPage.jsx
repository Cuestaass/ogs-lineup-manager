import React, { useEffect, useLayoutEffect, useState } from 'react';
import { AppShell } from './AppShell.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';

export function LegacyPage({ page, markup, loadController }) {
  const { activeTeam } = useAuth();
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    window.__OGS_TEAM__ = activeTeam;
    setReady(true);
  }, [activeTeam]);
  useEffect(() => {
    if (ready) loadController();
  }, [ready, loadController]);
  const screenMarkup = activeTeam ? markup.replaceAll('FC OGS', activeTeam.name) : markup;
  return <AppShell page={page}>{ready && <div className="react-screen" dangerouslySetInnerHTML={{ __html: screenMarkup }}/>}</AppShell>;
}
