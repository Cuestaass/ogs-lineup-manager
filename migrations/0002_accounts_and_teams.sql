PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, display_name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('owner','admin','member')),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sport TEXT NOT NULL DEFAULT 'Fútbol 7',
  external_team_slug TEXT,
  external_team_code TEXT,
  external_group_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS team_members (
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('manager','delegate','player')),
  status TEXT NOT NULL DEFAULT 'active',
  PRIMARY KEY (team_id, user_id)
);
CREATE TABLE IF NOT EXISTS team_subscriptions (
  team_id TEXT PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free','pilot','team')),
  status TEXT NOT NULL DEFAULT 'inactive' CHECK(status IN ('inactive','trialing','active','past_due','cancelled')),
  billing_owner_user_id TEXT REFERENCES users(id),
  provider TEXT,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  current_period_end TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS team_invites (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('delegate','player')),
  mode TEXT NOT NULL CHECK(mode IN ('single','group')),
  intended_email TEXT,
  max_uses INTEGER NOT NULL,
  use_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS roster_players (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  display_name TEXT NOT NULL,
  number INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id,user_id)
);
CREATE TABLE IF NOT EXISTS callups (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  match_id TEXT,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  response_deadline TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TEXT
);
CREATE TABLE IF NOT EXISTS callup_players (
  callup_id TEXT NOT NULL REFERENCES callups(id) ON DELETE CASCADE,
  roster_player_id TEXT NOT NULL REFERENCES roster_players(id) ON DELETE CASCADE,
  response TEXT NOT NULL DEFAULT 'pending' CHECK(response IN ('pending','available','unavailable')),
  responded_at TEXT,
  PRIMARY KEY(callup_id,roster_player_id)
);
CREATE TABLE IF NOT EXISTS match_goals (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  match_id TEXT NOT NULL,
  roster_player_id TEXT NOT NULL REFERENCES roster_players(id),
  minute INTEGER,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS user_follows (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  team_code TEXT NOT NULL,
  group_code TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, slug)
);
CREATE INDEX IF NOT EXISTS teams_by_workspace ON teams(workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS teams_by_external_slug ON teams(external_team_slug) WHERE external_team_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS follows_by_slug ON user_follows(slug);
CREATE INDEX IF NOT EXISTS invites_by_team ON team_invites(team_id,created_at);
CREATE INDEX IF NOT EXISTS roster_by_team ON roster_players(team_id,status);
CREATE INDEX IF NOT EXISTS callups_by_team ON callups(team_id,starts_at);
CREATE INDEX IF NOT EXISTS goals_by_match ON match_goals(team_id,match_id);
