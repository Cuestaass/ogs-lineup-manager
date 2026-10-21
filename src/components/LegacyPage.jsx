import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppShell } from './AppShell.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';
import { hasPermission } from '../../access.js';
import { api } from '../auth/supabase.js';

function filterMarkup(markup, roles) {
  const template = document.createElement('template');
  template.innerHTML = markup;
  template.content.querySelectorAll('[data-permission]').forEach(element => {
    if (!hasPermission(roles, element.dataset.permission)) element.remove();
  });
  return template.innerHTML;
}

export function LegacyPage({ page, markup, loadController, children }) {
  const { activeTeam } = useAuth();
  const [contentSlot, setContentSlot] = useState(null);
  const attachScreen = useCallback(node => setContentSlot(node?.querySelector('[data-page-content]') || null), []);
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    window.__OGS_TEAM__ = activeTeam;
    window.__OGS_API__ = api;
    setReady(true);
    return () => { delete window.__OGS_API__; };
  }, [activeTeam]);
  useEffect(() => {
    if (ready) loadController();
  }, [ready, loadController]);
  const screenMarkup = useMemo(() => filterMarkup(activeTeam ? markup.replaceAll('FC OGS', activeTeam.name) : markup, activeTeam?.roles || activeTeam?.role), [activeTeam, markup]);
  return <AppShell page={page}>{ready && <div ref={attachScreen} className="react-screen" dangerouslySetInnerHTML={{ __html: screenMarkup }}/>}{contentSlot && children && createPortal(children, contentSlot)}</AppShell>;
}
