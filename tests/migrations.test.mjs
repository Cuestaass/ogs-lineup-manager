import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

test('las migraciones crean el modelo de equipos, permisos y actividad', () => {
  const database = new DatabaseSync(':memory:');
  database.exec(readFileSync(new URL('../migrations/0001_jdm.sql', import.meta.url), 'utf8'));
  database.exec(readFileSync(new URL('../migrations/0002_accounts_and_teams.sql', import.meta.url), 'utf8'));
  database.exec(readFileSync(new URL('../migrations/0003_team_member_roles.sql', import.meta.url), 'utf8'));
  database.exec(readFileSync(new URL('../migrations/0004_team_competition_follows.sql', import.meta.url), 'utf8'));
  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name);
  for (const table of ['users', 'workspaces', 'teams', 'team_members', 'team_member_roles', 'team_subscriptions', 'team_invites', 'roster_players', 'callups', 'callup_players', 'match_goals', 'user_follows']) {
    assert.ok(tables.includes(table), `Falta la tabla ${table}`);
  }
  database.close();
});

test('un usuario puede tener un rol distinto en cada equipo independiente', () => {
  const database = new DatabaseSync(':memory:');
  database.exec(readFileSync(new URL('../migrations/0001_jdm.sql', import.meta.url), 'utf8'));
  database.exec(readFileSync(new URL('../migrations/0002_accounts_and_teams.sql', import.meta.url), 'utf8'));
  database.exec(readFileSync(new URL('../migrations/0003_team_member_roles.sql', import.meta.url), 'utf8'));
  database.exec(readFileSync(new URL('../migrations/0004_team_competition_follows.sql', import.meta.url), 'utf8'));
  database.exec(`
    INSERT INTO users(id,email,display_name) VALUES('user-1','multirol@example.com','Usuario multirol');
    INSERT INTO workspaces(id,name) VALUES('workspace-a','Club A'),('workspace-b','Club B');
    INSERT INTO teams(id,workspace_id,name) VALUES('team-a','workspace-a','Equipo A'),('team-b','workspace-b','Equipo B');
    INSERT INTO team_members(team_id,user_id,role,status) VALUES
      ('team-a','user-1','manager','active'),
      ('team-b','user-1','player','active');
  `);
  const roles = database.prepare('SELECT team_id,role FROM team_members WHERE user_id=? ORDER BY team_id').all('user-1').map(row => ({ ...row }));
  assert.deepEqual(roles, [
    { team_id: 'team-a', role: 'manager' },
    { team_id: 'team-b', role: 'player' }
  ]);
  database.close();
});

test('un usuario puede acumular manager o delegado y jugador dentro del mismo equipo', () => {
  const database = new DatabaseSync(':memory:');
  database.exec(readFileSync(new URL('../migrations/0001_jdm.sql', import.meta.url), 'utf8'));
  database.exec(readFileSync(new URL('../migrations/0002_accounts_and_teams.sql', import.meta.url), 'utf8'));
  database.exec(readFileSync(new URL('../migrations/0003_team_member_roles.sql', import.meta.url), 'utf8'));
  database.exec(readFileSync(new URL('../migrations/0004_team_competition_follows.sql', import.meta.url), 'utf8'));
  database.exec(`
    INSERT INTO users(id,email,display_name) VALUES('user-1','doble@example.com','Doble rol');
    INSERT INTO workspaces(id,name) VALUES('workspace-1','Club');
    INSERT INTO teams(id,workspace_id,name) VALUES('team-1','workspace-1','Equipo');
    INSERT INTO team_members(team_id,user_id,role,status) VALUES('team-1','user-1','manager','active');
    INSERT INTO team_member_roles(team_id,user_id,role) VALUES
      ('team-1','user-1','manager'),
      ('team-1','user-1','player');
  `);
  assert.deepEqual(
    database.prepare('SELECT role FROM team_member_roles WHERE team_id=? AND user_id=? ORDER BY role').all('team-1', 'user-1').map(row => row.role),
    ['manager', 'player']
  );
  database.close();
});

test('vincular una fuente oficial permite suscribir automáticamente a todos los miembros', () => {
  const database = new DatabaseSync(':memory:');
  database.exec(readFileSync(new URL('../migrations/0001_jdm.sql', import.meta.url), 'utf8'));
  database.exec(readFileSync(new URL('../migrations/0002_accounts_and_teams.sql', import.meta.url), 'utf8'));
  database.exec(readFileSync(new URL('../migrations/0003_team_member_roles.sql', import.meta.url), 'utf8'));
  database.exec(`
    INSERT INTO users(id,email,display_name) VALUES
      ('manager','manager@example.com','Mánager'),
      ('player','player@example.com','Jugador');
    INSERT INTO workspaces(id,name) VALUES('workspace','Club');
    INSERT INTO teams(id,workspace_id,name,external_team_slug,external_team_code,external_group_code)
      VALUES('team','workspace','Equipo','official-slug','123','456');
    INSERT INTO team_members(team_id,user_id,role,status) VALUES
      ('team','manager','manager','active'),
      ('team','player','player','active');
  `);
  database.exec(readFileSync(new URL('../migrations/0004_team_competition_follows.sql', import.meta.url), 'utf8'));
  assert.deepEqual(
    database.prepare('SELECT user_id,slug FROM user_follows ORDER BY user_id').all().map(row => ({ ...row })),
    [{ user_id: 'manager', slug: 'official-slug' }, { user_id: 'player', slug: 'official-slug' }]
  );
  database.close();
});
