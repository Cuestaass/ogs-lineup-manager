import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  getSession,
  localDevelopment,
  loginAsLocalPilot,
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword
} from './auth/supabase.js';
import '../public/styles.css';
import './login.css';

const safeReturnTo = () => {
  const value = new URLSearchParams(location.search).get('returnTo');
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/organizador/';
};

const initialMode = () => {
  const mode = new URLSearchParams(location.search).get('mode');
  return ['signup', 'reset', 'update-password'].includes(mode) ? mode : 'login';
};

function Login() {
  const [mode, setMode] = useState(initialMode);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Preparando el acceso…');
  const [error, setError] = useState('');

  useEffect(() => {
    getSession().then(session => {
      if (session && mode !== 'update-password') location.replace(safeReturnTo());
      else { setReady(true); setStatus(''); }
    }).catch(reason => { setReady(true); setStatus(''); setError(reason.message); });
  }, [mode]);

  const changeMode = next => {
    setMode(next);
    setError('');
    setStatus('');
    const params = new URLSearchParams(location.search);
    if (next === 'login') params.delete('mode'); else params.set('mode', next);
    history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}`);
  };

  const loginPilot = slug => {
    loginAsLocalPilot(slug);
    location.replace(safeReturnTo());
  };

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setStatus('');
    try {
      if (mode === 'login') {
        await signIn(String(form.get('email')), String(form.get('password')));
        location.replace(safeReturnTo());
      } else if (mode === 'signup') {
        const result = await signUp(String(form.get('email')), String(form.get('password')), String(form.get('name')));
        if (result.session) location.replace(safeReturnTo());
        else setStatus('Revisa tu correo para confirmar la cuenta.');
      } else if (mode === 'reset') {
        await requestPasswordReset(String(form.get('email')));
        setStatus('Si existe una cuenta con ese correo, recibirás un enlace para cambiar la contraseña.');
      } else {
        await updatePassword(String(form.get('password')));
        changeMode('login');
        setStatus('Contraseña actualizada. Ya puedes entrar.');
      }
    } catch (reason) {
      setError(reason.message || 'No se pudo completar la operación.');
    } finally { setBusy(false); }
  }

  const title = mode === 'signup' ? 'Crea tu espacio de equipo' : mode === 'reset' ? 'Recupera tu acceso' : mode === 'update-password' ? 'Elige una contraseña nueva' : 'Entra en tu espacio de equipo';

  return <main className="login-page">
    <section className="login-card" aria-labelledby="login-title">
      <div className="login-brand"><img src="/assets/fc-ogs-crest.png" alt=""/><span><strong>CUADERNO DE CAMPO</strong><small>TU EQUIPO, AISLADO Y A MANO</small></span></div>
      <p className="eyebrow">ÁREA PRIVADA</p><h1 id="login-title">{title}</h1>
      {status && <p role="status">{status}</p>}{error && <p className="login-error" role="alert">{error}</p>}
      {localDevelopment ? <div className="pilot-login-actions" aria-label="Cuentas piloto locales">
        <button className="header-link" type="button" onClick={() => loginPilot('fc-ogs')}>Entrar como manager · FC OGS</button>
        <button className="header-link" type="button" onClick={() => loginPilot('fc-ogs-ii')}>Entrar como manager · FC OGS II</button>
        <button className="header-link" type="button" onClick={() => loginPilot('inter-maccabi')}>Entrar como manager · Inter Maccabi</button>
      </div> : ready && <form className="login-form" onSubmit={submit}>
        {mode === 'signup' && <label>Nombre<input name="name" autoComplete="name" required/></label>}
        {mode !== 'update-password' && <label>Correo electrónico<input name="email" type="email" autoComplete="email" required/></label>}
        {mode !== 'reset' && <label>{mode === 'update-password' ? 'Contraseña nueva' : 'Contraseña'}<input name="password" type="password" minLength="8" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required/></label>}
        <button className="primary login-action" type="submit" disabled={busy}>{busy ? 'Procesando…' : mode === 'signup' ? 'Crear cuenta' : mode === 'reset' ? 'Enviar enlace' : mode === 'update-password' ? 'Guardar contraseña' : 'Iniciar sesión'}</button>
      </form>}
      {!localDevelopment && mode === 'login' && <div className="login-links"><button type="button" onClick={() => changeMode('signup')}>Crear una cuenta</button><button type="button" onClick={() => changeMode('reset')}>He olvidado mi contraseña</button></div>}
      {!localDevelopment && mode !== 'login' && <div className="login-links"><button type="button" onClick={() => changeMode('login')}>Volver al inicio de sesión</button></div>}
      <p className="login-note">La identidad y la contraseña se gestionan de forma segura mediante Supabase Auth.</p>
    </section>
  </main>;
}

createRoot(document.getElementById('root')).render(<Login/>);
