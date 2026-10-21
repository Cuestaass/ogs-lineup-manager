export const DEFAULT_RETURN_TO = '/organizador/';

export function safeReturnTo(value, fallback = DEFAULT_RETURN_TO) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}

export function registrationReturnTo(value) {
  const destination = safeReturnTo(value);
  const url = new URL(destination, 'https://lineups.ladderly.es');
  if (url.pathname === '/unirse/' && url.searchParams.has('token')) url.searchParams.set('accept', '1');
  return `${url.pathname}${url.search}${url.hash}`;
}

export function confirmationRedirect(origin, returnTo) {
  const callback = new URL('/login/', origin);
  callback.searchParams.set('returnTo', safeReturnTo(returnTo));
  return callback.toString();
}
