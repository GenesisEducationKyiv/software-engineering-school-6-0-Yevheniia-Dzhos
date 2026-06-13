import { query } from './database.js';

export async function hasProcessedMessage(messageId) {
  const result = await query(
    'SELECT 1 FROM processed_messages WHERE message_id = $1',
    [messageId]
  );

  return result.rowCount > 0;
}

export async function recordProcessedMessage(messageId, messageType) {
  await query(
    `INSERT INTO processed_messages (message_id, message_type)
     VALUES ($1, $2)
     ON CONFLICT (message_id) DO NOTHING`,
    [messageId, messageType]
  );
}
