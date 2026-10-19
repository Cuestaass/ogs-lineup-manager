import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../public/jdm.js', import.meta.url), 'utf8');

test('JDM dirige sus peticiones al dominio de API configurado', () => {
  assert.match(source, /__OGS_API_URL__/);
  assert.match(source, /__OGS_ACCESS_TOKEN__/);
});
