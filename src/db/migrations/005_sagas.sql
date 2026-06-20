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

CREATE UNIQUE INDEX IF NOT EXISTS idx_sagas_active_subscription_confirmation
ON sagas(type, (payload->>'subscriptionId'))
WHERE type = 'subscription-confirmation'
  AND state IN ('STARTED', 'NOTIFICATION_PENDING', 'COMPENSATING')
  AND payload ? 'subscriptionId';

CREATE INDEX IF NOT EXISTS idx_sagas_type_subscription_id
ON sagas(type, (payload->>'subscriptionId'));

CREATE TABLE IF NOT EXISTS processed_saga_replies (
  reply_id TEXT PRIMARY KEY,
  saga_id UUID NOT NULL REFERENCES sagas(id) ON DELETE CASCADE,
  reply_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_saga_replies_saga_id
ON processed_saga_replies(saga_id);
