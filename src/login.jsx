import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { beginLogin, completeLogin, getSession, loadAuthConfig } from './auth/oidc.js';
import '../public/styles.css';
import './login.css';

function Login() {
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState('Preparando el acceso…');
  const [error, setError] = useState('');
  useEffect(() => {
    if (getSession()) { location.replace('/organizador/'); return; }
    loadAuthConfig().then(async value => {
      setConfig(value);
      if (new URLSearchParams(location.search).has('code')) {
        setStatus('Completando el acceso…');
        await completeLogin(value);
        location.replace('/organizador/');
      } else setStatus('');
    }).catch(reason => { setStatus(''); setError(reason.message); });
  }, []);
  const loginPilot = slug => {
    const params = new URLSearchParams(location.search);
    params.set('pilot', slug);
    history.replaceState(null, '', `${location.pathname}?${params}`);
    beginLogin(config);
  };
  return <main className="login-page">
    <section className="login-card" aria-labelledby="login-title">
      <div className="login-brand"><img src="/assets/fc-ogs-crest.png" alt=""/><span><strong>CUADERNO DE CAMPO</strong><small>TU EQUIPO, AISLADO Y A MANO</small></span></div>
      <p className="eyebrow">ÁREA PRIVADA</p><h1 id="login-title">Entra en tu espacio de equipo</h1>
      <p>Consulta los partidos de los equipos que sigues y prepara alineaciones y jugadas sin mezclar plantillas.</p>
      {status && <p role="status">{status}</p>}{error && <p className="login-error" role="alert">{error}</p>}
      {config?.localDevelopment ? <div className="pilot-login-actions" aria-label="Cuentas piloto locales">
        <button className="header-link" type="button" onClick={() => loginPilot('fc-ogs')}>Entrar como manager · FC OGS</button>
        <button className="header-link" type="button" onClick={() => loginPilot('fc-ogs-ii')}>Entrar como manager · FC OGS II</button>
        <button className="header-link" type="button" onClick={() => loginPilot('inter-maccabi')}>Entrar como manager · Inter Maccabi</button>
      </div> : <button className="primary login-action" type="button" disabled={!config || Boolean(status)} onClick={() => beginLogin(config)}>Iniciar sesión</button>}
      <p className="login-note">El acceso utiliza OIDC con PKCE. La contraseña se gestiona en el proveedor de identidad y nunca llega a esta aplicación.</p>
    </section>
  </main>;
}
createRoot(document.getElementById('root')).render(<Login/>);
