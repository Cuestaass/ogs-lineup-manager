import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { canAccessPage } from '../../access.js';

const items = [
  ['equipo', '/equipo/', 'Gestión del equipo', <><path d="M4 20v-2a4 4 0 014-4h8a4 4 0 014 4v2"/><circle cx="12" cy="7" r="4"/></>],
  ['organizador', '/organizador/', 'La pizarra', <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 3v18M3 12h18M8 8l2 2m4 4 2 2"/></>],
  ['tactica', '/tactica/', 'Pizarra táctica', <><path d="M4 4h16v16H4zM12 4v16"/><circle cx="12" cy="12" r="3"/><path d="M7 8l2 2m6 4 2 2"/></>],
  ['jdm', '/jdm/', 'Partidos y clasificación', <path d="M4 19V5m0 0h16v14H4zM8 15l3-3 2 2 3-4"/>]
];

export function AppShell({ page, children }) {
  const { account, activeTeam, selectTeam, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef(null);
  const sidebarRef = useRef(null);
  useEffect(() => {
    document.body.dataset.page = page;
    document.body.classList.toggle('sidebar-open', open);
    const closeOnEscape = event => {
      if (event.key === 'Escape' && open) {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    if (open) requestAnimationFrame(() => sidebarRef.current?.querySelector('a, button, select')?.focus());
    return () => {
      document.body.classList.remove('sidebar-open');
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [page, open]);
  const visibleItems = items.filter(([key]) => canAccessPage(activeTeam?.role, key));
  const name = activeTeam?.name || 'Sin equipo';
  const home = visibleItems[0]?.[1] || '/jdm/';
  return <>
    <a className="skip-link" href="#main-content">Saltar al contenido</a>
    <button ref={toggleRef} className="sidebar-toggle" type="button" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-controls="app-sidebar" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
    </button>
    <aside ref={sidebarRef} className="app-sidebar" id="app-sidebar">
      <a className="sidebar-brand" href={home} aria-label={`${name} · Inicio`} onClick={() => setOpen(false)}><img src="/assets/fc-ogs-crest.png" alt="" width="62" height="62"/><span><strong>{name}</strong><small>{activeTeam ? 'CUADERNO DE CAMPO' : 'ESPERANDO INVITACIÓN'}</small></span></a>
      <div className="sidebar-divider"/>
      <p className="sidebar-caption">ESPACIO DE EQUIPO</p>
      <nav className="sidebar-nav" aria-label="Navegación principal">{visibleItems.map(([key, href, label, icon]) => <a key={key} href={href} aria-current={key === page ? 'page' : undefined} onClick={() => setOpen(false)}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icon}</svg><span>{label}</span></a>)}</nav>
      <div className="sidebar-footer">
        {account.teams.length > 1 && <label className="sidebar-team-picker"><span>EQUIPO ACTIVO</span><select value={activeTeam?.id || ''} onChange={event => selectTeam(event.target.value)}>{account.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>}
        <div>{activeTeam ? <>{name}<br/>{account.workspace?.name || 'Espacio de equipo'}</> : <>Cuenta activa<br/>{account.user?.email || 'Sin equipo asignado'}</>}</div>
        <button className="sidebar-logout" type="button" onClick={logout}>Cerrar sesión</button>
      </div>
    </aside>
    <button className="sidebar-backdrop" type="button" aria-label="Cerrar menú" onClick={() => { setOpen(false); toggleRef.current?.focus(); }}/>
    {children}
  </>;
}
