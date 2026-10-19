import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

test('las migraciones crean el modelo de equipos, permisos y actividad', () => {
  const database = new DatabaseSync(':memory:');
  database.exec(readFileSync(new URL('../migrations/0001_jdm.sql', import.meta.url), 'utf8'));
  database.exec(readFileSync(new URL('../migrations/0002_accounts_and_teams.sql', import.meta.url), 'utf8'));
  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name);
  for (const table of ['users', 'workspaces', 'teams', 'team_members', 'team_subscriptions', 'team_invites', 'roster_players', 'callups', 'callup_players', 'match_goals', 'user_follows']) {
    assert.ok(tables.includes(table), `Falta la tabla ${table}`);
  }
  database.close();
});
