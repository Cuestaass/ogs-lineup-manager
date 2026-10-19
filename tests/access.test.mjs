import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasPermission, subscriptionAllows, validateInvite } from '../access.js';

test('aplica la jerarquía de permisos del equipo', () => {
  assert.equal(hasPermission('manager', 'billing.manage'), true);
  assert.equal(hasPermission('manager', 'goals.record'), true);
  assert.equal(hasPermission('delegate', 'lineups.manage'), true);
  assert.equal(hasPermission('delegate', 'billing.manage'), false);
  assert.equal(hasPermission('player', 'callups.respond'), true);
  assert.equal(hasPermission('player', 'roster.manage'), false);
  assert.equal(hasPermission('fan', 'callups.respond'), false);
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
