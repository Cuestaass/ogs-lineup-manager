PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS team_member_roles (
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('manager','delegate','player')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (team_id, user_id, role),
  FOREIGN KEY (team_id, user_id) REFERENCES team_members(team_id, user_id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO team_member_roles(team_id,user_id,role)
SELECT team_id,user_id,role FROM team_members;

CREATE INDEX IF NOT EXISTS member_roles_by_user ON team_member_roles(user_id,team_id);
