import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../auth/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { AppShell } from '../components/AppShell.jsx';

const readJson = async response => {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'No se pudo completar la operación.');
  return body;
};

export default function TeamManagementPage() {
  const { activeTeam } = useAuth();
  const [data, setData] = useState({ access: null, members: [], invites: [], roster: [], callups: [], matches: [], goals: [] });
  const [status, setStatus] = useState('Cargando el equipo…');
  const [createdInvite, setCreatedInvite] = useState(null);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const base = `/api/teams/${encodeURIComponent(activeTeam.id)}`;

  const load = useCallback(async () => {
    setStatus('Actualizando…');
    try {
      const access = await readJson(await api(`${base}/access`));
      const canManageMembers = access.permissions.includes('members.manage');
      const canManageRoster = access.permissions.includes('roster.manage');
      const canRecordGoals = access.permissions.includes('goals.record');
      const [members, invites, roster, callups, matchData] = await Promise.all([
        canManageMembers ? api(`${base}/members`).then(readJson) : [],
        access.permissions.includes('members.invite') ? api(`${base}/invites`).then(readJson) : [],
        canManageRoster ? api(`${base}/roster`).then(readJson) : [],
        api(`${base}/callups`).then(readJson),
        canRecordGoals ? api(`${base}/matches`).then(readJson) : { matches: [], goals: [] }
      ]);
      setData({ access, members, invites, roster, callups, ...matchData });
      setStatus('');
    } catch (error) { setStatus(error.message); }
  }, [base]);
  useEffect(() => { load(); }, [load]);

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
    setStatus('Revocando invitación…');
    try { await readJson(await api(`${base}/invites/${encodeURIComponent(id)}`, { method: 'DELETE' })); await load(); } catch (error) { setStatus(error.message); }
  }
  async function submitPlayer(event) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    try { await readJson(await api(`${base}/roster`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ displayName: form.get('displayName'), number: form.get('number') || null }) })); formElement.reset(); await load(); } catch (error) { setStatus(error.message); }
  }
  async function submitCallup(event) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    try {
      await readJson(await api(`${base}/callups`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: form.get('title'), startsAt: new Date(form.get('startsAt')).toISOString(), responseDeadline: form.get('responseDeadline') ? new Date(form.get('responseDeadline')).toISOString() : null, playerIds: selectedPlayers }) }));
      formElement.reset(); setSelectedPlayers([]); await load();
    } catch (error) { setStatus(error.message); }
  }
  async function respondToCallup(id, response) {
    setStatus('Guardando tu respuesta…');
    try {
      await readJson(await api(`/api/callups/${encodeURIComponent(id)}/respond`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ response }) }));
      await load();
    } catch (error) { setStatus(error.message); }
  }
  async function submitGoal(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setStatus('Registrando goleador…');
    try {
      await readJson(await api(`${base}/goals`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ matchId: form.get('matchId'), rosterPlayerId: form.get('rosterPlayerId'), minute: form.get('minute') || null }) }));
      formElement.reset();
      await load();
    } catch (error) { setStatus(error.message); }
  }
  const access = data.access;
  const manager = access?.role === 'manager';
  const sportManager = ['manager', 'delegate'].includes(access?.role);
  return <AppShell page="equipo">
    <header className="app-header"><div><p className="eyebrow">GESTIÓN PRIVADA</p><h1>El equipo</h1><p>Miembros, plantilla y convocatorias de {activeTeam.name}.</p></div><div className="management-badge">{access?.subscription.plan || '—'} · {access?.subscription.status || '—'}</div></header>
    <main id="main-content" className="management-main">
      <p className="feedback management-status" role="status" aria-live="polite">{status}</p>
      {access && <section className="management-summary" aria-label="Resumen de acceso"><div><span>Rol</span><strong>{access.role}</strong></div><div><span>Plan</span><strong>{access.subscription.plan}</strong></div><div><span>Gestión</span><strong>{access.teamManagementEnabled ? 'Activa' : 'Requiere suscripción'}</strong></div></section>}

      {manager && <section className="panel management-section"><div className="section-heading"><div><p className="eyebrow">01 / ACCESO</p><h2>Miembros e invitaciones</h2><p>Los enlaces individuales se consumen una vez; los colectivos admiten varios jugadores.</p></div></div>
        <div className="management-columns">
          <form className="management-form" onSubmit={submitInvite}>
            <label><span>Rol</span><select name="role" required><option value="delegate">Delegado</option><option value="player">Jugador</option></select></label>
            <label><span>Tipo de enlace</span><select name="mode" required><option value="single">Individual · un uso</option><option value="group">Colectivo de jugadores</option></select></label>
            <label><span>Correo opcional</span><input name="email" type="email" placeholder="persona@ejemplo.com"/></label>
            <label><span>Usos máximos del colectivo</span><input name="maxUses" type="number" min="2" max="250" defaultValue="25"/></label>
            <label><span>Caducidad en días</span><input name="expiresInDays" type="number" min="1" max="30" defaultValue="7"/></label>
            <button className="primary" type="submit">Crear invitación</button>
          </form>
          <div>
            {createdInvite && <div className="invite-result"><strong>Enlace creado</strong><input readOnly value={createdInvite.url}/><button type="button" className="secondary" onClick={() => navigator.clipboard.writeText(createdInvite.url)}>Copiar enlace</button>{createdInvite.emailDelivery === 'pending-external-provider' && <small>El correo queda pendiente hasta conectar el proveedor transaccional.</small>}</div>}
            <div className="table-wrap"><table className="players-table"><thead><tr><th>Persona</th><th>Rol</th><th>Estado</th></tr></thead><tbody>{data.members.map(member => <tr key={member.user_id}><td>{member.display_name}<small>{member.email}</small></td><td>{member.role}</td><td>{member.status}</td></tr>)}</tbody></table></div>
          </div>
        </div>
        <div className="invite-list">{data.invites.map(invite => <article key={invite.id}><div><strong>{invite.role} · {invite.mode}</strong><span>{invite.use_count}/{invite.max_uses} usos · caduca {new Date(invite.expires_at).toLocaleDateString('es-ES')}</span></div><button className="danger ghost" type="button" disabled={Boolean(invite.revoked_at)} onClick={() => revokeInvite(invite.id)}>{invite.revoked_at ? 'Revocada' : 'Revocar'}</button></article>)}</div>
      </section>}

      {sportManager && <section className="panel management-section"><div className="section-heading"><div><p className="eyebrow">02 / PLANTILLA</p><h2>Jugadores</h2><p>Las cuentas invitadas como jugador se vinculan automáticamente; también puedes preparar fichas antes del registro.</p></div></div>
        <form className="management-form compact" onSubmit={submitPlayer}><label><span>Nombre</span><input name="displayName" required maxLength="80"/></label><label><span>Dorsal</span><input name="number" type="number" min="1" max="999"/></label><button className="primary" type="submit">Añadir jugador</button></form>
        <div className="roster-cards">{data.roster.map(player => <article key={player.id}><strong>{player.number || '—'}</strong><span>{player.display_name}</span><small>{player.user_id ? 'Cuenta vinculada' : 'Pendiente de vincular'}</small></article>)}</div>
      </section>}

      {sportManager && <section className="panel management-section"><div className="section-heading"><div><p className="eyebrow">03 / CONVOCATORIAS</p><h2>Disponibilidad</h2><p>Convoca a la plantilla y consulta las respuestas.</p></div></div>
        <form className="management-form callup-form" onSubmit={submitCallup}><label><span>Título</span><input name="title" required placeholder="Jornada 6"/></label><label><span>Fecha del partido</span><input name="startsAt" type="datetime-local" required/></label><label><span>Límite de respuesta</span><input name="responseDeadline" type="datetime-local"/></label><fieldset><legend>Jugadores</legend><div className="callup-player-list">{data.roster.map(player => <label key={player.id}><input type="checkbox" checked={selectedPlayers.includes(player.id)} onChange={event => setSelectedPlayers(current => event.target.checked ? [...current, player.id] : current.filter(id => id !== player.id))}/><span>{player.display_name}</span></label>)}</div></fieldset><button className="primary" type="submit">Crear convocatoria</button></form>
        <div className="callup-list">{data.callups.map(callup => <article key={callup.id}><div><strong>{callup.title}</strong><span>{new Date(callup.starts_at).toLocaleString('es-ES')}</span></div><div><b>{callup.available || 0}</b> disponibles · <b>{callup.unavailable || 0}</b> no disponibles · {callup.invited || 0} convocados</div></article>)}</div>
      </section>}

      {sportManager && <section className="panel management-section"><div className="section-heading"><div><p className="eyebrow">04 / ACTA</p><h2>Goleadores</h2><p>Sólo se aceptan goles de partidos que ya figuran como finalizados en la fuente oficial.</p></div></div>
        {data.matches.length && data.roster.length ? <form className="management-form goal-form" onSubmit={submitGoal}><label><span>Partido finalizado</span><select name="matchId" required>{data.matches.map(match => <option key={match.id} value={match.id}>{match.date || 'Sin fecha'} · {match.home} – {match.away}</option>)}</select></label><label><span>Goleador</span><select name="rosterPlayerId" required><option value="">Selecciona jugador</option>{data.roster.map(player => <option key={player.id} value={player.id}>{player.number ? `${player.number} · ` : ''}{player.display_name}</option>)}</select></label><label><span>Minuto opcional</span><input name="minute" type="number" min="0" max="200"/></label><button className="primary" type="submit">Registrar gol</button></form> : <p className="management-empty">Vincula el equipo con JDM y espera a que exista un resultado oficial finalizado para registrar goleadores.</p>}
        {data.goals.length > 0 && <div className="goal-list">{data.goals.map(goal => <article key={goal.id}><strong>{goal.player_name}</strong><span>{goal.minute == null ? 'Minuto no indicado' : `Minuto ${goal.minute}`}</span><small>{goal.match_id}</small></article>)}</div>}
      </section>}

      {access?.role === 'player' && <section className="panel management-section player-callups"><div className="section-heading"><div><p className="eyebrow">01 / CONVOCATORIAS</p><h2>Confirma tu asistencia</h2><p>Tu respuesta queda vinculada a tu ficha de jugador.</p></div></div>
        <div className="callup-list">{data.callups.length ? data.callups.map(callup => <article key={callup.id}><div><strong>{callup.title}</strong><span>{new Date(callup.starts_at).toLocaleString('es-ES')}</span>{callup.response_deadline && <small>Responde antes del {new Date(callup.response_deadline).toLocaleString('es-ES')}</small>}</div><div className="callup-response"><span>Respuesta: <b>{callup.my_response || 'pendiente'}</b></span><button type="button" className={callup.my_response === 'available' ? 'primary' : ''} onClick={() => respondToCallup(callup.id, 'available')}>Disponible</button><button type="button" className={callup.my_response === 'unavailable' ? 'danger' : ''} onClick={() => respondToCallup(callup.id, 'unavailable')}>No disponible</button></div></article>) : <p className="management-empty">No tienes convocatorias pendientes.</p>}</div>
      </section>}
    </main>
  </AppShell>;
}
