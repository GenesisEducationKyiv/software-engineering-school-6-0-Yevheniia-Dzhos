CREATE TABLE IF NOT EXISTS repositories (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL UNIQUE,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  last_seen_tag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  confirm_token TEXT NOT NULL UNIQUE,
  unsubscribe_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  UNIQUE(email, repository_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_email
ON subscriptions(email);

CREATE INDEX IF NOT EXISTS idx_subscriptions_active
ON subscriptions(confirmed, unsubscribed_at);