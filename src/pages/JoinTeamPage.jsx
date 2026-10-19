import React, { useEffect, useState } from 'react';
import { api, getSession } from '../auth/oidc.js';

const readJson = async response => {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'No se pudo abrir la invitación.');
  return body;
};

const roleName = role => role === 'delegate' ? 'delegado' : 'jugador';

export default function JoinTeamPage() {
  const token = new URLSearchParams(location.search).get('token') || '';
  const session = getSession();
  const [invitation, setInvitation] = useState(null);
  const [status, setStatus] = useState(token ? 'Comprobando invitación…' : 'Falta el token de invitación.');
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!token) return;
    api(`/api/invites/${encodeURIComponent(token)}`).then(readJson).then(value => {
      setInvitation(value);
      setStatus('');
    }).catch(error => setStatus(error.message));
  }, [token]);

  async function accept() {
    setStatus('Uniéndote al equipo…');
    try {
      const result = await readJson(await api(`/api/invites/${encodeURIComponent(token)}/accept`, { method: 'POST' }));
      localStorage.setItem('ogs-active-team-v1', result.teamId);
      setJoined(true);
      setStatus('');
    } catch (error) { setStatus(error.message); }
  }

  const returnTo = `${location.pathname}${location.search}`;
  return <main id="main-content" className="join-screen">
    <a className="join-brand" href="/"><img src="/assets/fc-ogs-crest.png" alt=""/><span><strong>Mi equipo</strong><small>CUADERNO DE CAMPO</small></span></a>
    <section className="join-card">
      <p className="eyebrow">INVITACIÓN DE EQUIPO</p>
      {joined ? <><h1>Ya formas parte del equipo</h1><p>La invitación se ha consumido correctamente. Puedes entrar en tu nuevo espacio.</p><a className="header-link join-primary" href="/equipo/">Abrir el equipo</a></> : <>
        <h1>{invitation ? invitation.teamName : 'Acceso al equipo'}</h1>
        {invitation && <div className="join-details"><div><span>Te unes como</span><strong>{roleName(invitation.role)}</strong></div><div><span>Tipo de acceso</span><strong>{invitation.mode === 'single' ? 'individual' : 'colectivo'}</strong></div><div><span>Caduca</span><strong>{new Date(invitation.expiresAt).toLocaleDateString('es-ES')}</strong></div></div>}
        {status && <p className="join-status" role="status">{status}</p>}
        {invitation && !session && <><p>Identifícate antes de aceptar. Volverás a esta invitación después del acceso.</p><a className="header-link join-primary" href={`/login/?returnTo=${encodeURIComponent(returnTo)}`}>Identificarme y continuar</a></>}
        {invitation && session && <button type="button" className="primary join-primary" onClick={accept}>Aceptar invitación</button>}
      </>}
    </section>
  </main>;
}
