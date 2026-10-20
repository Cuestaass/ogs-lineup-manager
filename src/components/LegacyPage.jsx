import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { AppShell } from './AppShell.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';
import { hasPermission } from '../../access.js';

function filterMarkup(markup, roles) {
  const template = document.createElement('template');
  template.innerHTML = markup;
  template.content.querySelectorAll('[data-permission]').forEach(element => {
    if (!hasPermission(roles, element.dataset.permission)) element.remove();
  });
  return template.innerHTML;
}

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
  const screenMarkup = useMemo(() => filterMarkup(activeTeam ? markup.replaceAll('FC OGS', activeTeam.name) : markup, activeTeam?.roles || activeTeam?.role), [activeTeam, markup]);
  return <AppShell page={page}>{ready && <div className="react-screen" dangerouslySetInnerHTML={{ __html: screenMarkup }}/>}</AppShell>;
}
