import { query } from './database.js';

const STALE_CLAIM_MS = 5 * 60 * 1000;

export async function hasProcessedMessage(messageId) {
  const result = await query(
    "SELECT 1 FROM processed_messages WHERE message_id = $1 AND status = 'sent'",
    [messageId]
  );

  return result.rowCount > 0;
}

export async function recordProcessedMessage(messageId, messageType) {
  const result = await query(
    `INSERT INTO processed_messages (message_id, message_type, status, processed_at)
     VALUES ($1, $2, 'pending', NOW())
     ON CONFLICT (message_id) DO UPDATE
       SET processed_at = NOW()
       WHERE processed_messages.status = 'pending'
         AND processed_messages.processed_at < NOW() - ($3 || ' milliseconds')::interval
     RETURNING message_id`,
    [messageId, messageType, STALE_CLAIM_MS]
  );

  return result.rowCount > 0;
}

export async function markProcessedMessageSent(messageId) {
  await query(
    "UPDATE processed_messages SET status = 'sent' WHERE message_id = $1",
    [messageId]
  );
}

export async function deleteProcessedMessage(messageId) {
  await query(
    'DELETE FROM processed_messages WHERE message_id = $1',
    [messageId]
  );
}
