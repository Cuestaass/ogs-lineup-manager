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

test('fusionar una cuenta con una ficha manual conserva convocatorias y goles', () => {
  const database = new DatabaseSync(':memory:');
  for (const migration of ['0001_jdm.sql', '0002_accounts_and_teams.sql', '0003_team_member_roles.sql', '0004_team_competition_follows.sql']) {
    database.exec(readFileSync(new URL(`../migrations/${migration}`, import.meta.url), 'utf8'));
  }
  database.exec(`
    INSERT INTO users(id,email,display_name) VALUES('manager','manager@example.com','Mánager'),('player','player@example.com','Jugador');
    INSERT INTO workspaces(id,name) VALUES('workspace','Club');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('workspace','manager','owner'),('workspace','player','member');
    INSERT INTO teams(id,workspace_id,name) VALUES('team','workspace','Equipo');
    INSERT INTO team_members(team_id,user_id,role,status) VALUES('team','manager','manager','active'),('team','player','player','active');
    INSERT INTO team_member_roles(team_id,user_id,role) VALUES('team','manager','manager'),('team','player','player');
    INSERT INTO roster_players(id,team_id,user_id,display_name,number) VALUES
      ('manual','team',NULL,'Jugador deportivo',7),
      ('automatic','team','player','Nombre de la cuenta',NULL);
    INSERT INTO callups(id,team_id,title,starts_at,created_by) VALUES('callup','team','Partido','2026-10-25T10:00:00Z','manager');
    INSERT INTO callup_players(callup_id,roster_player_id,response) VALUES('callup','manual','pending'),('callup','automatic','available');
    INSERT INTO match_goals(id,team_id,match_id,roster_player_id,created_by) VALUES('goal','team','match','automatic','manager');
  `);
  database.exec(`
    DELETE FROM callup_players WHERE roster_player_id='manual' AND callup_id IN (SELECT callup_id FROM callup_players WHERE roster_player_id='automatic');
    UPDATE callup_players SET roster_player_id='manual' WHERE roster_player_id='automatic';
    UPDATE match_goals SET roster_player_id='manual' WHERE roster_player_id='automatic';
    DELETE FROM roster_players WHERE id='automatic';
    UPDATE roster_players SET user_id='player',status='active' WHERE id='manual' AND team_id='team';
  `);
  assert.deepEqual({ ...database.prepare('SELECT id,user_id,display_name,number FROM roster_players').get() }, { id: 'manual', user_id: 'player', display_name: 'Jugador deportivo', number: 7 });
  assert.deepEqual({ ...database.prepare('SELECT roster_player_id,response FROM callup_players').get() }, { roster_player_id: 'manual', response: 'available' });
  assert.equal(database.prepare('SELECT roster_player_id FROM match_goals WHERE id=?').get('goal').roster_player_id, 'manual');
  database.close();
});
