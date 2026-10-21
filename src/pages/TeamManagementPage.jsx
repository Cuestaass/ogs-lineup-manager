import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../auth/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { AppShell } from '../components/AppShell.jsx';

const sectionDetails = {
  inicio: { eyebrow: 'EL EQUIPO', title: 'Inicio', description: 'Resumen general del equipo y su actividad.' },
  plantilla: { eyebrow: 'PLANTILLA', title: 'Plantilla', description: 'Jugadores y vinculación de cuentas.' },
  convocatorias: { eyebrow: 'CONVOCATORIAS', title: 'Convocatorias', description: 'Disponibilidad, respuestas y próximas convocatorias.' },
  ajustes: { eyebrow: 'AJUSTES DEL EQUIPO', title: 'Ajustes del equipo', description: 'Miembros, permisos e invitaciones.' }
};

const readSectionFromHash = () => {
  const section = window.location.hash.slice(1);
  return Object.hasOwn(sectionDetails, section) ? section : 'inicio';
};

const readJson = async response => {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'No se pudo completar la operación.');
  return body;
};

function InviteRows({ invites, statusFor, dateFor, onRevoke }) {
  if (!invites.length) return <p className="management-empty">No hay invitaciones en esta sección.</p>;
  return <div className="invite-list">{invites.map(invite => {
    const status = statusFor(invite);
    return <article key={invite.id}>
      <div className="invite-row-main"><strong>{invite.role === 'player' ? 'Jugador' : invite.role === 'delegate' ? 'Delegado' : invite.role} <span>· {invite.mode === 'single' ? 'Individual' : 'Colectiva'}</span></strong><small>{invite.intended_email || (invite.mode === 'group' ? 'Enlace para varios jugadores' : 'Enlace individual')}</small></div>
      <div className="invite-row-meta"><span className={`invite-status is-${status.toLocaleLowerCase('es').replace('á', 'a')}`}>{status}</span><span>{invite.use_count}/{invite.max_uses} usos</span><span>Caduca {dateFor(invite.expires_at)}</span></div>
      <div className="invite-row-actions">{status === 'Pendiente' ? <button className="danger ghost" type="button" onClick={() => onRevoke(invite.id)}>Revocar</button> : <span>—</span>}</div>
    </article>;
  })}</div>;
}

function CallupCard({ callup, onRespond, canRespond = false, showPlayers = false }) {
  const players = callup.players || [];
  const groups = [
    { id: 'available', label: 'Disponibles', players: players.filter(player => player.response === 'available') },
    { id: 'unavailable', label: 'No disponibles', players: players.filter(player => player.response === 'unavailable') },
    { id: 'pending', label: 'Sin responder', players: players.filter(player => !player.response || player.response === 'pending') }
  ];
  const counts = players.length ? groups.map(group => group.players.length) : [Number(callup.available || 0), Number(callup.unavailable || 0), Math.max(0, Number(callup.invited || 0) - Number(callup.available || 0) - Number(callup.unavailable || 0))];
  const deadlinePassed = callup.response_deadline && new Date(callup.response_deadline).getTime() < Date.now();
  const cancelled = Boolean(callup.cancelled_at);
  const startsAt = new Date(callup.starts_at);
  const past = startsAt.getTime() < Date.now();
  const deadline = callup.response_deadline ? new Date(callup.response_deadline) : null;
  const dateTime = value => new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(value);
  return <article className={`callup-card${cancelled ? ' is-cancelled' : ''}`}>
    <div className="callup-card-header"><div><p className="eyebrow">{cancelled ? 'CANCELADA' : past ? 'ANTERIOR' : 'ACTIVA'}</p><h3>{callup.title}</h3></div><span className={`callup-status ${cancelled ? 'is-cancelled' : deadlinePassed || past ? 'is-closed' : 'is-open'}`}>{cancelled ? 'Cancelada' : past ? 'Finalizada' : deadlinePassed ? 'Plazo cerrado' : 'Plazo abierto'}</span></div>
    <div className="callup-card-meta"><span><b>Convocatoria</b>{dateTime(startsAt)}</span><span className={deadlinePassed ? 'callup-deadline is-past' : 'callup-deadline'}><b>Fecha límite</b>{deadline ? dateTime(deadline) : 'Sin fecha límite'}</span></div>
    <div className="callup-card-summary" aria-label="Resumen de disponibilidad"><div><strong>{counts[0]}</strong><span>Disponibles</span></div><div><strong>{counts[1]}</strong><span>No disponibles</span></div><div className={counts[2] ? 'needs-attention' : ''}><strong>{counts[2]}</strong><span>Sin responder</span></div></div>
    {showPlayers && <details className="callup-detail"><summary>Ver jugadores <span>{players.length}</span></summary><div className="callup-player-groups">{groups.map(group => <section key={group.id} className={`callup-player-group is-${group.id}`}><h4>{group.label}<span>{group.players.length}</span></h4>{group.players.length ? <ul>{group.players.map(player => <li key={player.id}><span>{player.number ? <b>{player.number}</b> : null}{player.display_name}</span>{player.responded_at && <small>Respondió {new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(player.responded_at))}</small>}</li>)}</ul> : <p>Sin jugadores</p>}</section>)}</div></details>}
    {canRespond && <div className="callup-response"><span>Tu respuesta: <b>{callup.my_response || 'pendiente'}</b></span><button type="button" disabled={deadlinePassed || cancelled} className={callup.my_response === 'available' ? 'primary' : ''} onClick={() => onRespond(callup.id, 'available')}>Disponible</button><button type="button" disabled={deadlinePassed || cancelled} className={callup.my_response === 'unavailable' ? 'danger' : ''} onClick={() => onRespond(callup.id, 'unavailable')}>No disponible</button></div>}
  </article>;
}

export default function TeamManagementPage() {
  const { activeTeam } = useAuth();
  const [data, setData] = useState({ access: null, members: [], invites: [], roster: [], linkCandidates: [], callups: [], jdmTeams: [] });
  const [status, setStatus] = useState('Cargando el equipo…');
  const [createdInvite, setCreatedInvite] = useState(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [callupDialogOpen, setCallupDialogOpen] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [rosterQuery, setRosterQuery] = useState('');
  const [rosterFilter, setRosterFilter] = useState('all');
  const [activeSection, setActiveSection] = useState(readSectionFromHash);
  const base = `/api/teams/${encodeURIComponent(activeTeam.id)}`;

  const load = useCallback(async () => {
    setStatus('Actualizando…');
    try {
      const access = await readJson(await api(`${base}/access`));
      const canManageMembers = access.permissions.includes('members.manage');
      const canManageRoster = access.permissions.includes('roster.manage');
      const [members, invites, roster, linkCandidates, callups, jdmTeams] = await Promise.all([
        canManageMembers ? api(`${base}/members`).then(readJson) : [],
        access.permissions.includes('members.invite') ? api(`${base}/invites`).then(readJson) : [],
        canManageRoster ? api(`${base}/roster`).then(readJson) : [],
        canManageRoster ? api(`${base}/roster/candidates`).then(readJson) : [],
        api(`${base}/callups`).then(readJson),
        api('/api/jdm/teams').then(readJson).catch(() => [])
      ]);
      setData({ access, members, invites, roster, linkCandidates, callups, jdmTeams });
      setStatus('');
    } catch (error) { setStatus(error.message); }
  }, [base]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const syncSection = () => {
      // The shell's skip link moves focus within the current team section.
      if (window.location.hash !== '#main-content') setActiveSection(readSectionFromHash());
    };
    window.addEventListener('hashchange', syncSection);
    return () => window.removeEventListener('hashchange', syncSection);
  }, []);

  async function submitInvite(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setStatus('Creando invitación…');
    try {
      const result = await readJson(await api(`${base}/invites`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role: form.get('role'), mode: form.get('mode'), email: form.get('email'), maxUses: Number(form.get('maxUses')), expiresInDays: Number(form.get('expiresInDays')) }) }));
      setCreatedInvite(result); formElement.reset(); await load();
    } catch (error) { setStatus(error.message); }
  }
  async function revokeInvite(id) {
    if (!confirm('¿Revocar esta invitación? El enlace dejará de funcionar inmediatamente.')) return;
    setStatus('Revocando invitación…');
    try { await readJson(await api(`${base}/invites/${encodeURIComponent(id)}`, { method: 'DELETE' })); await load(); } catch (error) { setStatus(error.message); }
  }
  async function removeRole(member, role) {
    if (!confirm(`¿Quitar el rol de ${role} a ${member.display_name}?`)) return;
    setStatus('Actualizando permisos…');
    try { await readJson(await api(`${base}/members/${encodeURIComponent(member.user_id)}/roles/${encodeURIComponent(role)}`, { method: 'DELETE' })); await load(); } catch (error) { setStatus(error.message); }
  }
  async function removeMember(member) {
    if (!confirm(`¿Eliminar el acceso de ${member.display_name} a este equipo? Su ficha deportiva se conservará sin vincular.`)) return;
    setStatus('Eliminando acceso…');
    try { await readJson(await api(`${base}/members/${encodeURIComponent(member.user_id)}`, { method: 'DELETE' })); await load(); } catch (error) { setStatus(error.message); }
  }
  async function linkPlayer(event, playerId) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const userId = String(form.get('userId') || '');
    if (!userId) return;
    setStatus('Vinculando jugador y cuenta…');
    try {
      await readJson(await api(`${base}/roster/${encodeURIComponent(playerId)}/link`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId }) }));
      await load();
    } catch (error) { setStatus(error.message); }
  }
  async function submitPlayer(event) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    try { await readJson(await api(`${base}/roster`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ displayName: form.get('displayName'), number: form.get('number') || null }) })); formElement.reset(); await load(); } catch (error) { setStatus(error.message); }
  }
  async function submitCallup(event) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    try {
      await readJson(await api(`${base}/callups`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: form.get('title'), startsAt: new Date(form.get('startsAt')).toISOString(), responseDeadline: form.get('responseDeadline') ? new Date(form.get('responseDeadline')).toISOString() : null, playerIds: selectedPlayers }) }));
      formElement.reset(); setSelectedPlayers([]); setCallupDialogOpen(false); await load();
    } catch (error) { setStatus(error.message); }
  }
  async function respondToCallup(id, response) {
    setStatus('Guardando tu respuesta…');
    try {
      await readJson(await api(`/api/callups/${encodeURIComponent(id)}/respond`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ response }) }));
      await load();
    } catch (error) { setStatus(error.message); }
  }
  const access = data.access;
  const roles = access?.roles || (access?.role ? [access.role] : []);
  const manager = roles.includes('manager');
  const sportManager = access?.permissions.some(permission => ['roster.manage', 'callups.manage'].includes(permission));
  const sectionLinks = [
    { id: 'inicio', label: 'Inicio', available: true },
    { id: 'plantilla', label: 'Plantilla', available: sportManager },
    { id: 'convocatorias', label: 'Convocatorias', available: sportManager || roles.includes('player') },
    { id: 'ajustes', label: 'Ajustes del equipo', available: manager }
  ].filter(item => item.available);
  const sectionAvailable = sectionLinks.some(item => item.id === activeSection);
  const visibleSection = access && sectionAvailable ? activeSection : 'inicio';
  const section = sectionDetails[visibleSection];
  const teamSources = data.jdmTeams.filter(item => item.managedByTeam);
  const source = teamSources.find(item => item.name?.trim().toLocaleLowerCase('es') === activeTeam.name?.trim().toLocaleLowerCase('es')) || (teamSources.length === 1 ? teamSources[0] : null);
  const upcomingMatch = (source?.fixtures || []).filter(match => match.scheduled && !['F', 'N'].includes(match.status) && match.date).map(match => ({ ...match, dateValue: new Date(match.date.split('/').length === 3 && match.date.indexOf('/') === 2 ? match.date.split('/').reverse().join('-') : match.date) })).filter(match => !Number.isNaN(match.dateValue.getTime()) && match.dateValue >= new Date(Date.now() - 86400000)).sort((a, b) => a.dateValue - b.dateValue)[0];
  const upcomingCallups = data.callups.filter(callup => new Date(callup.starts_at).getTime() >= Date.now());
  const activeTeamCallups = data.callups.filter(callup => !callup.cancelled_at && new Date(callup.starts_at).getTime() >= Date.now()).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const previousTeamCallups = data.callups.filter(callup => callup.cancelled_at || new Date(callup.starts_at).getTime() < Date.now()).sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
  const nextCallup = [...upcomingCallups].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0];
  const pendingResponses = nextCallup ? Math.max(0, (nextCallup.invited || 0) - (nextCallup.available || 0) - (nextCallup.unavailable || 0)) : 0;
  const pendingLinks = data.roster.filter(player => !player.user_id).length;
  const filteredRoster = useMemo(() => data.roster.filter(player => {
    const matchesName = player.display_name.toLocaleLowerCase('es').includes(rosterQuery.trim().toLocaleLowerCase('es'));
    const matchesStatus = rosterFilter === 'all' || (rosterFilter === 'linked' ? Boolean(player.user_id) : !player.user_id);
    return matchesName && matchesStatus;
  }), [data.roster, rosterQuery, rosterFilter]);
  const inviteStatus = invite => {
    if (invite.revoked_at) return 'Revocada';
    if (new Date(invite.expires_at).getTime() <= Date.now()) return 'Caducada';
    if (invite.use_count >= invite.max_uses) return 'Utilizada';
    return 'Pendiente';
  };
  const pendingInvites = data.invites.filter(invite => inviteStatus(invite) === 'Pendiente');
  const inviteHistory = data.invites.filter(invite => inviteStatus(invite) !== 'Pendiente');
  const inviteDate = value => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
  const dateLabel = date => date ? new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date) : '';
  const timeLabel = time => time ? time.slice(0, 5) : 'Hora pendiente';
  return <AppShell page="equipo">
    <header className="app-header"><div><p className="eyebrow">{section.eyebrow}</p><h1>{section.title}</h1><p>{section.description} <strong>{activeTeam.name}</strong></p></div><div className="management-badge">{access?.subscription.plan || '—'} · {access?.subscription.status || '—'}</div></header>
    <main id="main-content" className="management-main">
      <nav className="section-nav management-nav" aria-label="Secciones del equipo">{sectionLinks.map((item, index) => <a key={item.id} href={`/equipo/#${item.id}`} aria-current={item.id === visibleSection ? 'page' : undefined}><span>{String(index + 1).padStart(2, '0')}</span>{item.label}</a>)}</nav>
      <p className="feedback management-status" role="status" aria-live="polite">{status}</p>
      {access && visibleSection === 'inicio' && <section className="team-dashboard" aria-label="Dashboard operativo del equipo">
        <section className="dashboard-match" aria-labelledby="dashboard-match-title"><div className="dashboard-match-kicker"><p className="eyebrow">PRÓXIMO PARTIDO</p><span>{upcomingMatch ? 'JDM · calendario oficial' : nextCallup ? 'Según la convocatoria' : 'AGENDA'}</span></div>
          {upcomingMatch ? <><h2 id="dashboard-match-title">{upcomingMatch.home} <i>—</i> {upcomingMatch.away}</h2><div className="dashboard-match-meta"><strong>{dateLabel(upcomingMatch.dateValue)}</strong><span>{timeLabel(upcomingMatch.time)}</span><span>{upcomingMatch.venue || 'Campo pendiente'}</span></div></> : nextCallup ? <><h2 id="dashboard-match-title">{nextCallup.title}</h2><div className="dashboard-match-meta"><strong>{dateLabel(new Date(nextCallup.starts_at))}</strong><span>{timeLabel(new Date(nextCallup.starts_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }))}</span><span>Partido y lugar por confirmar</span></div></> : <><h2 id="dashboard-match-title">Calendario por confirmar</h2><p className="dashboard-empty">{teamSources.length > 1 ? 'No se puede asociar un calendario JDM único a este equipo.' : 'Aún no hay un próximo partido disponible. Vincula el equipo a JDM o consulta más adelante.'}</p></>}
          <a href="/jdm/" className="dashboard-text-link">Ver calendario de partidos <span aria-hidden="true">↗</span></a>
        </section>
        <section className="dashboard-availability" aria-labelledby="dashboard-availability-title"><div className="section-heading"><div><p className="eyebrow">DISPONIBILIDAD</p><h2 id="dashboard-availability-title">{nextCallup ? nextCallup.title : 'Sin convocatoria próxima'}</h2></div><a className="dashboard-text-link" href="/equipo/#convocatorias">Convocatorias ↗</a></div>
          {nextCallup ? <><p className="dashboard-callup-date">{dateLabel(new Date(nextCallup.starts_at))} · {timeLabel(new Date(nextCallup.starts_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }))}</p><div className="availability-stats"><div><strong>{nextCallup.available || 0}</strong><span>Disponibles</span></div><div><strong>{nextCallup.unavailable || 0}</strong><span>No disponibles</span></div><div className={pendingResponses ? 'needs-attention' : ''}><strong>{pendingResponses}</strong><span>Sin respuesta</span></div></div></> : <p className="dashboard-empty">Crea una convocatoria para consultar la disponibilidad de la plantilla.</p>}
        </section>
        <section className="dashboard-actions" aria-labelledby="dashboard-actions-title"><div className="section-heading"><div><p className="eyebrow">ACCESOS RÁPIDOS</p><h2 id="dashboard-actions-title">Herramientas del equipo</h2></div></div><div className="dashboard-link-list">
          {sportManager && <a href="/equipo/#plantilla"><span>01</span><strong>Plantilla</strong><small>{data.roster.length} jugadores</small><b aria-hidden="true">↗</b></a>}
          {(sportManager || roles.includes('player')) && <a href="/equipo/#convocatorias"><span>02</span><strong>Convocatorias</strong><small>{upcomingCallups.length} próximas</small><b aria-hidden="true">↗</b></a>}
          <a href="/jdm/"><span>03</span><strong>Partidos</strong><small>Calendario y resultados</small><b aria-hidden="true">↗</b></a>
          {access.permissions.includes('tactics.manage') && <a href="/tactica/"><span>04</span><strong>Pizarra táctica</strong><small>Preparación del equipo</small><b aria-hidden="true">↗</b></a>}
        </div></section>
        <section className="dashboard-attention" aria-labelledby="dashboard-attention-title"><div className="section-heading"><div><p className="eyebrow">SEGUIMIENTO</p><h2 id="dashboard-attention-title">Pendiente de atención</h2></div><strong className="attention-total">{(sportManager ? pendingResponses + pendingLinks : data.callups.filter(callup => !callup.my_response && new Date(callup.starts_at).getTime() >= Date.now()).length)}</strong></div>
          {sportManager && pendingResponses > 0 && <a href="/equipo/#convocatorias"><span className="attention-mark"/>Faltan {pendingResponses} respuestas en «{nextCallup.title}»<b>Revisar ↗</b></a>}
          {sportManager && pendingLinks > 0 && <a href="/equipo/#plantilla"><span className="attention-mark"/>{pendingLinks} {pendingLinks === 1 ? 'jugador pendiente' : 'jugadores pendientes'} de vincular<b>Revisar ↗</b></a>}
          {!sportManager && roles.includes('player') && data.callups.filter(callup => !callup.my_response && new Date(callup.starts_at).getTime() >= Date.now()).map(callup => <a key={callup.id} href="/equipo/#convocatorias"><span className="attention-mark"/>Confirma tu respuesta: «{callup.title}»<b>Responder ↗</b></a>)}
          {(!sportManager || (pendingResponses === 0 && pendingLinks === 0)) && (!roles.includes('player') || !data.callups.some(callup => !callup.my_response && new Date(callup.starts_at).getTime() >= Date.now())) && <p className="dashboard-empty">No hay acciones pendientes que requieran atención.</p>}
        </section>
      </section>}

      {manager && visibleSection === 'ajustes' && <section className="panel management-section team-access-panel"><div className="section-heading team-access-heading"><div><p className="eyebrow">MIEMBROS Y PERMISOS</p><h2>Acceso al equipo</h2><p>Gestiona los miembros, sus roles y los enlaces de invitación.</p></div><button className="primary" type="button" onClick={() => { setCreatedInvite(null); setInviteDialogOpen(true); }}>Invitar miembro</button></div>
        <section className="team-access-group" aria-labelledby="members-heading"><div className="team-access-group-heading"><div><p className="eyebrow">01 · EQUIPO</p><h3 id="members-heading">Miembros actuales</h3></div><span className="team-access-count">{data.members.length}</span></div>
          <div className="table-wrap management-members-table"><table className="players-table"><thead><tr><th>Persona</th><th>Roles y permisos</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{data.members.map(member => <tr key={member.user_id}><td data-label="Persona">{member.display_name}<small>{member.email}</small></td><td data-label="Roles"><div className="member-role-list">{(member.roles || [member.role]).map(role => <span key={role}>{role}<button type="button" className="ghost member-role-remove" onClick={() => removeRole(member, role)} aria-label={`Quitar rol ${role} a ${member.display_name}`}>×</button></span>)}</div></td><td data-label="Estado">{member.status}</td><td data-label="Acciones"><button type="button" className="danger ghost member-access-remove" onClick={() => removeMember(member)}>Quitar acceso</button></td></tr>)}</tbody></table></div>
          {!data.members.length && <p className="management-empty">Aún no hay miembros en este equipo.</p>}
        </section>
        <section className="team-access-group" aria-labelledby="pending-invites-heading"><div className="team-access-group-heading"><div><p className="eyebrow">02 · POR ACEPTAR</p><h3 id="pending-invites-heading">Invitaciones pendientes</h3></div><span className="team-access-count">{pendingInvites.length}</span></div>
          <InviteRows invites={pendingInvites} statusFor={inviteStatus} dateFor={inviteDate} onRevoke={revokeInvite} />
        </section>
        <section className="team-access-group" aria-labelledby="invite-history-heading"><div className="team-access-group-heading"><div><p className="eyebrow">03 · REGISTRO</p><h3 id="invite-history-heading">Historial de invitaciones</h3></div><span className="team-access-count">{inviteHistory.length}</span></div>
          <InviteRows invites={inviteHistory} statusFor={inviteStatus} dateFor={inviteDate} onRevoke={revokeInvite} />
        </section>
        {inviteDialogOpen && <div className="invite-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setInviteDialogOpen(false); }}><section className="invite-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-dialog-title"><div className="invite-dialog-heading"><div><p className="eyebrow">NUEVO ACCESO</p><h2 id="invite-dialog-title">Invitar miembro</h2></div><button type="button" className="ghost invite-dialog-close" aria-label="Cerrar" onClick={() => setInviteDialogOpen(false)}>×</button></div>
          <p className="invite-dialog-copy">Los enlaces individuales se consumen una vez; los colectivos admiten varios jugadores.</p>
          <form className="management-form invite-form" onSubmit={submitInvite}>
            <label><span>Rol</span><select name="role" required><option value="delegate">Delegado</option><option value="player">Jugador</option></select></label>
            <label><span>Tipo de enlace</span><select name="mode" required><option value="single">Individual · un uso</option><option value="group">Colectivo de jugadores</option></select></label>
            <label><span>Correo opcional</span><input name="email" type="email" placeholder="persona@ejemplo.com"/></label>
            <label><span>Usos máximos del colectivo</span><input name="maxUses" type="number" min="2" max="250" defaultValue="25"/></label>
            <label><span>Caducidad en días</span><input name="expiresInDays" type="number" min="1" max="30" defaultValue="7"/></label>
            <div className="invite-form-actions"><button className="secondary" type="button" onClick={() => setInviteDialogOpen(false)}>Cancelar</button><button className="primary" type="submit">Crear invitación</button></div>
          </form>
          {createdInvite && <div className="invite-result"><strong>Enlace creado</strong><input readOnly value={createdInvite.url}/><button type="button" className="secondary" onClick={() => navigator.clipboard.writeText(createdInvite.url)}>Copiar enlace</button>{createdInvite.emailDelivery === 'pending-external-provider' && <small>El correo queda pendiente hasta conectar el proveedor transaccional.</small>}</div>}
        </section></div>}
      </section>}

      {sportManager && visibleSection === 'plantilla' && <section className="panel management-section"><div className="section-heading"><div><p className="eyebrow">JUGADORES Y CUENTAS</p><h2>Jugadores</h2><p>Las cuentas invitadas como jugador se vinculan automáticamente; también puedes preparar fichas antes del registro.</p></div></div>
        <form className="management-form compact roster-add-form" onSubmit={submitPlayer}><label><span>Nombre</span><input name="displayName" required maxLength="80" placeholder="Nombre del jugador"/></label><label><span>Dorsal</span><input name="number" type="number" min="1" max="999" placeholder="—"/></label><button className="primary" type="submit">Añadir jugador</button></form>
        <div className="roster-toolbar"><label className="roster-search"><span>Buscar jugador</span><input type="search" value={rosterQuery} onChange={event => setRosterQuery(event.target.value)} placeholder="Escribe un nombre"/></label><label className="roster-filter"><span>Estado</span><select value={rosterFilter} onChange={event => setRosterFilter(event.target.value)}><option value="all">Todos ({data.roster.length})</option><option value="linked">Vinculados ({data.roster.length - pendingLinks})</option><option value="pending">Pendientes ({pendingLinks})</option></select></label></div>
        {filteredRoster.length ? <>
          <div className="table-wrap roster-desktop-table"><table className="players-table roster-table"><thead><tr><th>Jugador</th><th>Dorsal</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{filteredRoster.map(player => <tr key={player.id}><td data-label="Jugador"><strong>{player.display_name}</strong></td><td data-label="Dorsal"><span className="roster-number">{player.number || '—'}</span></td><td data-label="Estado"><span className={`roster-status ${player.user_id ? 'is-linked' : 'is-pending'}`}><i aria-hidden="true"/>{player.user_id ? 'Vinculado' : 'Pendiente'}</span></td><td data-label="Acciones">{!player.user_id ? <form className="roster-link-form" onSubmit={event => linkPlayer(event, player.id)}><label><span className="sr-only">Cuenta para {player.display_name}</span><select name="userId" required defaultValue=""><option value="" disabled>Selecciona una cuenta</option>{data.linkCandidates.map(candidate => <option key={candidate.user_id} value={candidate.user_id}>{candidate.display_name} · {candidate.roles.join(' + ')}{candidate.linked_player_name ? ` · vinculada a ${candidate.linked_player_name}` : ''}</option>)}</select></label><button type="submit" className="secondary" disabled={!data.linkCandidates.length}>Vincular</button></form> : <span className="roster-action-done">Cuenta vinculada</span>}</td></tr>)}</tbody></table></div>
          <div className="roster-mobile-cards">{filteredRoster.map(player => <article key={player.id} className="roster-mobile-card"><div className="roster-card-main"><span className="roster-number">{player.number || '—'}</span><div><h3>{player.display_name}</h3><span className={`roster-status ${player.user_id ? 'is-linked' : 'is-pending'}`}><i aria-hidden="true"/>{player.user_id ? 'Vinculado' : 'Pendiente'}</span></div></div>{!player.user_id ? <form className="roster-link-form" onSubmit={event => linkPlayer(event, player.id)}><label><span className="sr-only">Cuenta para {player.display_name}</span><select name="userId" required defaultValue=""><option value="" disabled>Selecciona una cuenta</option>{data.linkCandidates.map(candidate => <option key={candidate.user_id} value={candidate.user_id}>{candidate.display_name} · {candidate.roles.join(' + ')}{candidate.linked_player_name ? ` · vinculada a ${candidate.linked_player_name}` : ''}</option>)}</select></label><button type="submit" className="secondary" disabled={!data.linkCandidates.length}>Vincular</button></form> : <p className="roster-action-done">Cuenta vinculada</p>}</article>)}</div>
        </> : <p className="management-empty roster-empty">{data.roster.length ? 'No hay jugadores que coincidan con la búsqueda y el estado.' : 'Aún no hay jugadores. Añade el primero con el formulario.'}</p>}
      </section>}

      {sportManager && visibleSection === 'convocatorias' && <section className="panel management-section callups-management"><div className="section-heading callups-page-heading"><div><p className="eyebrow">DISPONIBILIDAD</p><h2>Convocatorias</h2><p>Consulta las respuestas y detecta rápidamente quién falta por responder.</p></div><button className="primary" type="button" onClick={() => { setSelectedPlayers([]); setCallupDialogOpen(true); }}>Crear convocatoria</button></div>
        <section className="callups-section" aria-labelledby="active-callups-title"><div className="callups-section-heading"><div><p className="eyebrow">EN CURSO</p><h3 id="active-callups-title">Activas</h3></div><span>{activeTeamCallups.length}</span></div>
          {activeTeamCallups.length ? <div className="callup-cards">{activeTeamCallups.map(callup => <CallupCard key={callup.id} callup={callup} onRespond={respondToCallup} showPlayers={access.permissions.includes('callups.manage')}/>)}</div> : <p className="management-empty">No hay convocatorias activas.</p>}
        </section>
        <section className="callups-section" aria-labelledby="previous-callups-title"><div className="callups-section-heading"><div><p className="eyebrow">ARCHIVO</p><h3 id="previous-callups-title">Anteriores</h3></div><span>{previousTeamCallups.length}</span></div>
          {previousTeamCallups.length ? <div className="callup-cards">{previousTeamCallups.map(callup => <CallupCard key={callup.id} callup={callup} onRespond={respondToCallup} showPlayers={access.permissions.includes('callups.manage')}/>)}</div> : <p className="management-empty">Todavía no hay convocatorias anteriores.</p>}
        </section>
        {callupDialogOpen && <div className="invite-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setCallupDialogOpen(false); }}><section className="invite-dialog callup-dialog" role="dialog" aria-modal="true" aria-labelledby="callup-dialog-title"><div className="invite-dialog-heading"><div><p className="eyebrow">NUEVA CONVOCATORIA</p><h2 id="callup-dialog-title">Crear convocatoria</h2></div><button type="button" className="ghost invite-dialog-close" aria-label="Cerrar" onClick={() => setCallupDialogOpen(false)}>×</button></div>
          <p className="invite-dialog-copy">Elige la fecha, el plazo y los jugadores que deben responder.</p>
          <form className="management-form callup-form callup-dialog-form" onSubmit={submitCallup}><label><span>Título</span><input name="title" required placeholder="Jornada 6"/></label><label><span>Fecha del partido</span><input name="startsAt" type="datetime-local" required/></label><label><span>Límite de respuesta</span><input name="responseDeadline" type="datetime-local"/></label><fieldset><legend>Jugadores</legend><div className="callup-player-list">{data.roster.map(player => <label key={player.id}><input type="checkbox" checked={selectedPlayers.includes(player.id)} onChange={event => setSelectedPlayers(current => event.target.checked ? [...current, player.id] : current.filter(id => id !== player.id))}/><span>{player.display_name}</span></label>)}</div></fieldset><div className="invite-form-actions"><button className="secondary" type="button" onClick={() => setCallupDialogOpen(false)}>Cancelar</button><button className="primary" type="submit">Crear convocatoria</button></div></form>
        </section></div>}
      </section>}

      {roles.includes('player') && visibleSection === 'convocatorias' && <section className="panel management-section player-callups callups-management"><div className="section-heading"><div><p className="eyebrow">MIS CONVOCATORIAS</p><h2>Confirma tu asistencia</h2><p>Tu respuesta queda vinculada a tu ficha de jugador.</p></div></div>
        {activeTeamCallups.length ? <div className="callup-cards">{activeTeamCallups.map(callup => <CallupCard key={callup.id} callup={callup} onRespond={respondToCallup} canRespond/>)}</div> : <p className="management-empty">No tienes convocatorias activas.</p>}
        {previousTeamCallups.length > 0 && <section className="callups-section"><div className="callups-section-heading"><div><p className="eyebrow">ARCHIVO</p><h3>Anteriores</h3></div><span>{previousTeamCallups.length}</span></div><div className="callup-cards">{previousTeamCallups.map(callup => <CallupCard key={callup.id} callup={callup} onRespond={respondToCallup} canRespond/>)}</div></section>}
      </section>}
    </main>
  </AppShell>;
}
