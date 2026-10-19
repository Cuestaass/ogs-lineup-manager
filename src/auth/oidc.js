const SESSION_KEY = 'ogs-session-v1';
const VERIFIER_KEY = 'ogs-oidc-verifier';
const STATE_KEY = 'ogs-oidc-state';

const encode = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const random = size => encode(crypto.getRandomValues(new Uint8Array(size)));
const challenge = async verifier => encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));

export function getSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    return session?.accessToken ? session : null;
  } catch { return null; }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function loadAuthConfig() {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    return { localDevelopment: true };
  }
  const response = await fetch('/api/config', { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error('No se pudo cargar la configuración de acceso.');
  const config = await response.json();
  if (!config.issuer || !config.clientId) throw new Error('El acceso OIDC todavía no está configurado en el servidor.');
  return config;
}

export async function beginLogin(config) {
  if (config.localDevelopment) {
    const pilotSlug = new URLSearchParams(location.search).get('pilot') || 'fc-ogs';
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken: 'local-development', profile: { sub: `pilot-manager-${pilotSlug}`, name: `Manager piloto · ${pilotSlug}`, pilotSlug } }));
    const returnTo = new URLSearchParams(location.search).get('returnTo');
    location.replace(returnTo?.startsWith('/') ? returnTo : '/organizador/');
    return;
  }
  const verifier = random(64);
  const state = random(24);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  const authorize = new URL(`${config.issuer.replace(/\/$/, '')}/protocol/openid-connect/auth`);
  authorize.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: `${location.origin}/login/`,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    code_challenge: await challenge(verifier),
    code_challenge_method: 'S256'
  });
  location.assign(authorize);
}

export async function completeLogin(config, params = new URLSearchParams(location.search)) {
  const code = params.get('code');
  if (!code) return null;
  if (params.get('state') !== sessionStorage.getItem(STATE_KEY)) throw new Error('La respuesta de acceso no es válida.');
  const tokenUrl = `${config.issuer.replace(/\/$/, '')}/protocol/openid-connect/token`;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      redirect_uri: `${location.origin}/login/`,
      code,
      code_verifier: sessionStorage.getItem(VERIFIER_KEY) || ''
    })
  });
  if (!response.ok) throw new Error('No se pudo completar el acceso.');
  const tokens = await response.json();
  const profile = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(tokens.access_token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')), value => value.charCodeAt(0))));
  const session = { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: Date.now() + tokens.expires_in * 1000, profile };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  history.replaceState(null, '', '/login/');
  return session;
}

export async function api(path, options = {}) {
  const session = getSession();
  const localHost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (session?.accessToken === 'local-development' || (localHost && /^\/api\/invites\//.test(path))) return (await import('../api/localApi.js')).localApi(path, options);
  const headers = new Headers(options.headers);
  if (session?.accessToken) headers.set('authorization', `Bearer ${session.accessToken}`);
  headers.set('accept', 'application/json');
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401) {
    clearSession();
    location.replace('/login/');
    throw new Error('La sesión ha caducado.');
  }
  return response;
}
