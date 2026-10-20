export const TEAM_ROLES = ['manager', 'delegate', 'player'];

export const ROLE_PERMISSIONS = Object.freeze({
  manager: ['billing.manage', 'team.manage', 'members.manage', 'members.invite', 'roster.manage', 'callups.manage', 'callups.respond', 'tactics.manage', 'lineups.manage', 'goals.record'],
  delegate: ['roster.manage', 'callups.manage', 'callups.respond', 'tactics.manage', 'lineups.manage', 'goals.record'],
  player: ['callups.respond']
});

export const PAGE_PERMISSIONS = Object.freeze({
  equipo: null,
  organizador: 'lineups.manage',
  tactica: 'tactics.manage',
  jdm: 'authenticated'
});

export const hasPermission = (role, permission) => Boolean(ROLE_PERMISSIONS[role]?.includes(permission));

export function canAccessPage(role, page) {
  const permission = PAGE_PERMISSIONS[page];
  if (permission === 'authenticated') return true;
  if (permission == null) return TEAM_ROLES.includes(role);
  return hasPermission(role, permission);
}

export function validateInvite(input) {
  const role = input?.role;
  const mode = input?.mode;
  if (!['delegate', 'player'].includes(role)) throw new Error('Sólo se puede invitar a delegados o jugadores.');
  if (!['single', 'group'].includes(mode)) throw new Error('Modalidad de invitación inválida.');
  if (role === 'delegate' && mode !== 'single') throw new Error('Las invitaciones de delegado deben ser individuales.');
  const maxUses = mode === 'single' ? 1 : Number(input.maxUses || 25);
  if (mode === 'group' && (!Number.isSafeInteger(maxUses) || maxUses < 2 || maxUses > 250)) throw new Error('El límite del enlace colectivo debe estar entre 2 y 250.');
  const expiresInDays = Number(input.expiresInDays || 7);
  if (!Number.isSafeInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 30) throw new Error('La invitación debe caducar entre 1 y 30 días.');
  return { role, mode, maxUses, expiresInDays, email: input.email ? String(input.email).trim().toLowerCase() : null };
}

export function subscriptionAllows(subscription, feature) {
  if (!['team_management'].includes(feature)) return true;
  return ['active', 'trialing'].includes(subscription?.status) && ['team', 'pilot'].includes(subscription?.plan);
}
