CREATE TABLE IF NOT EXISTS releases (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(repository_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_releases_repository_discovered
ON releases(repository_id, discovered_at DESC);
