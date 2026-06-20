CREATE TABLE IF NOT EXISTS sagas (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL,
  state TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sagas_type_created
ON sagas(type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sagas_state
ON sagas(state);