ALTER TABLE subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_email_repository_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_active_unique
ON subscriptions (email, repository_id)
WHERE unsubscribed_at IS NULL;
