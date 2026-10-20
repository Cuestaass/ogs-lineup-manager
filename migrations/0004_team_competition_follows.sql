PRAGMA foreign_keys = ON;

ALTER TABLE teams ADD COLUMN pilot_slug TEXT;

UPDATE teams
SET pilot_slug=external_team_slug,
    external_team_slug=NULL
WHERE external_team_slug IN ('fc-ogs','fc-ogs-ii','inter-maccabi')
  AND external_team_code IS NULL
  AND external_group_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS teams_by_pilot_slug
ON teams(pilot_slug) WHERE pilot_slug IS NOT NULL;

UPDATE teams
SET external_team_slug=(
      SELECT f.slug FROM user_follows f
      WHERE lower(f.name)=lower(teams.name)
      ORDER BY f.created_at LIMIT 1
    ),
    external_team_code=(
      SELECT f.team_code FROM user_follows f
      WHERE lower(f.name)=lower(teams.name)
      ORDER BY f.created_at LIMIT 1
    ),
    external_group_code=(
      SELECT f.group_code FROM user_follows f
      WHERE lower(f.name)=lower(teams.name)
      ORDER BY f.created_at LIMIT 1
    )
WHERE EXISTS (
  SELECT 1 FROM user_follows f WHERE lower(f.name)=lower(teams.name)
);

INSERT OR IGNORE INTO user_follows(user_id,slug,name,team_code,group_code)
SELECT tm.user_id,t.external_team_slug,t.name,t.external_team_code,t.external_group_code
FROM team_members tm
JOIN teams t ON t.id=tm.team_id
WHERE tm.status='active'
  AND t.external_team_slug IS NOT NULL
  AND t.external_team_code IS NOT NULL
  AND t.external_group_code IS NOT NULL;
