import { createClient } from '@supabase/supabase-js';

const LOCAL_SESSION_KEY = 'ogs-session-v1';
const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const supabaseKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '');
const apiUrl = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const localHost = typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname);

if (typeof window !== 'undefined') window.__OGS_API_URL__ = apiUrl;

export const localDevelopment = localHost && !supabaseUrl && !supabaseKey;

if (!localDevelopment && (!supabaseUrl || !supabaseKey || !apiUrl)) {
  throw new Error('Faltan VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY o VITE_API_URL.');
}

export const supabase = localDevelopment ? null : createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const localSession = () => {
  try {
    const session = JSON.parse(sessionStorage.getItem(LOCAL_SESSION_KEY));
    return session?.accessToken ? session : null;
  } catch { return null; }
};

const normalizeSession = session => session ? {
  ...session,
  accessToken: session.access_token,
  profile: {
    sub: session.user.id,
    email: session.user.email,
    name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email
  }
} : null;

export async function getSession() {
  if (localDevelopment) return localSession();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return normalizeSession(data.session);
}

export function onAuthStateChange(callback) {
  if (localDevelopment) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(normalizeSession(session)));
  return () => data.subscription.unsubscribe();
}

export function loginAsLocalPilot(slug = 'fc-ogs') {
  if (!localDevelopment) return;
  sessionStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({
    accessToken: 'local-development',
    profile: { sub: `pilot-manager-${slug}`, name: `Manager piloto · ${slug}`, pilotSlug: slug }
  }));
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${location.origin}/login/`
    }
  });
  if (error) throw error;
  return data;
}

export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${location.origin}/login/?mode=update-password`
  });
  if (error) throw error;
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function clearSession() {
  if (localDevelopment) sessionStorage.removeItem(LOCAL_SESSION_KEY);
  else await supabase.auth.signOut();
}

export async function api(path, options = {}) {
  const session = await getSession();
  if (session?.accessToken === 'local-development' || (localDevelopment && /^\/api\/invites\//.test(path))) {
    return (await import('../api/localApi.js')).localApi(path, options);
  }
  const headers = new Headers(options.headers);
  if (session?.accessToken) headers.set('authorization', `Bearer ${session.accessToken}`);
  headers.set('accept', 'application/json');
  const response = await fetch(`${apiUrl}${path}`, { ...options, headers });
  if (response.status === 401 && session) {
    await clearSession();
    const returnTo = `${location.pathname}${location.search}`;
    location.replace(`/login/?returnTo=${encodeURIComponent(returnTo)}`);
    throw new Error('La sesión ha caducado.');
  }
  return response;
}
