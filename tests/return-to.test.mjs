import assert from 'node:assert/strict';
import { test } from 'node:test';
import { confirmationRedirect, registrationReturnTo, safeReturnTo } from '../src/auth/returnTo.js';

test('conserva la invitación en la confirmación y activa su aceptación automática', () => {
  const invitation = '/unirse/?token=token-secreto';
  const destination = registrationReturnTo(invitation);
  assert.equal(destination, '/unirse/?token=token-secreto&accept=1');

  const callback = new URL(confirmationRedirect('https://lineups.ladderly.es', destination));
  assert.equal(callback.pathname, '/login/');
  assert.equal(callback.searchParams.get('returnTo'), destination);
});

test('no añade aceptación automática a un registro ordinario', () => {
  assert.equal(registrationReturnTo('/organizador/'), '/organizador/');
});

test('rechaza destinos externos en el retorno de autenticación', () => {
  assert.equal(safeReturnTo('https://malicioso.example'), '/organizador/');
  assert.equal(safeReturnTo('//malicioso.example'), '/organizador/');
});
