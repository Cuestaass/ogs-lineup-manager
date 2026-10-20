import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAccessPage, hasPermission, permissionsForRoles, primaryRole, subscriptionAllows, validateInvite } from '../access.js';

test('aplica la jerarquía de permisos del equipo', () => {
  assert.equal(hasPermission('manager', 'billing.manage'), true);
  assert.equal(hasPermission('manager', 'goals.record'), true);
  assert.equal(hasPermission('delegate', 'lineups.manage'), true);
  assert.equal(hasPermission('delegate', 'billing.manage'), false);
  assert.equal(hasPermission('player', 'callups.respond'), true);
  assert.equal(hasPermission('player', 'roster.manage'), false);
  assert.equal(hasPermission('fan', 'callups.respond'), false);
});

test('combina permisos cuando una persona tiene varios roles en el mismo equipo', () => {
  const roles = ['delegate', 'player'];
  assert.equal(primaryRole(roles), 'delegate');
  assert.equal(hasPermission(roles, 'roster.manage'), true);
  assert.equal(hasPermission(roles, 'callups.respond'), true);
  assert.equal(permissionsForRoles(roles).includes('billing.manage'), false);
  assert.equal(canAccessPage(['manager', 'player'], 'organizador'), true);
});

test('la navegación sólo expone páginas permitidas por el rol', () => {
  assert.equal(canAccessPage(undefined, 'equipo'), false);
  assert.equal(canAccessPage(undefined, 'jdm'), true);
  assert.equal(canAccessPage('player', 'equipo'), true);
  assert.equal(canAccessPage('player', 'organizador'), false);
  assert.equal(canAccessPage('delegate', 'organizador'), true);
  assert.equal(canAccessPage('manager', 'tactica'), true);
});

test('las invitaciones individuales son de un uso y las colectivas sólo admiten jugadores', () => {
  assert.deepEqual(validateInvite({ role: 'delegate', mode: 'single' }).maxUses, 1);
  assert.deepEqual(validateInvite({ role: 'player', mode: 'single' }).maxUses, 1);
  assert.deepEqual(validateInvite({ role: 'player', mode: 'group', maxUses: 40 }).maxUses, 40);
  assert.throws(() => validateInvite({ role: 'delegate', mode: 'group', maxUses: 10 }), /individuales/);
});

test('la gestión requiere un plan de equipo activo', () => {
  assert.equal(subscriptionAllows({ plan: 'team', status: 'active' }, 'team_management'), true);
  assert.equal(subscriptionAllows({ plan: 'pilot', status: 'active' }, 'team_management'), true);
  assert.equal(subscriptionAllows({ plan: 'free', status: 'inactive' }, 'team_management'), false);
  assert.equal(subscriptionAllows({ plan: 'team', status: 'past_due' }, 'team_management'), false);
});
