import { query } from '../../db/client.js';

const errorNotProvided = Symbol('errorNotProvided');

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

export async function createSaga({ id, type, state, payload }, client) {
  const executor = client || { query };
  const result = await executor.query(
    `INSERT INTO sagas (id, type, state, payload)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [id, type, state, payload]
  );

  return result.rows[0];
}

export async function findSagaById(id) {
  const result = await query(
    'SELECT * FROM sagas WHERE id = $1',
    [id]
  );

  return result.rows[0] || null;
}

export async function findActiveSagaBySubscriptionId({
  type,
  subscriptionId,
  states
}) {
  const result = await query(
    `SELECT id, type, state, payload, error, created_at, updated_at, completed_at
     FROM sagas
     WHERE type = $1
       AND payload->>'subscriptionId' = $2
       AND state = ANY($3)
     ORDER BY created_at DESC
     LIMIT 1`,
    [type, String(subscriptionId), states]
  );

  return result.rows[0] || null;
}

export async function updateSagaState(
  id,
  state,
  options = {}
) {
  const {
    payload,
    completed = false,
    expectedState
  } = options;
  const error = hasOwn(options, 'error') ? options.error : errorNotProvided;
  const result = await query(
    `UPDATE sagas
     SET state = $2,
         payload = COALESCE($3, payload),
         error = CASE WHEN $4 THEN $5 ELSE error END,
         updated_at = NOW(),
         completed_at = CASE WHEN $6 THEN NOW() ELSE completed_at END
     WHERE id = $1
       AND ($7::text IS NULL OR state = $7)
     RETURNING *`,
    [
      id,
      state,
      payload,
      error !== errorNotProvided,
      error === errorNotProvided ? null : error,
      completed,
      expectedState ?? null
    ]
  );

  return result.rows[0] || null;
}

export async function listRecentSagas({
  limit = 20,
  offset = 0,
  state,
  type
} = {}) {
  const result = await query(
    `SELECT id, type, state, payload, error, created_at, updated_at, completed_at
     FROM sagas
     WHERE ($3::text IS NULL OR state = $3)
       AND ($4::text IS NULL OR type = $4)
     ORDER BY created_at DESC
     LIMIT $1
     OFFSET $2`,
    [limit, offset, state ?? null, type ?? null]
  );

  return result.rows;
}

export async function listTimedOutSagas({
  states,
  olderThan,
  limit = 20
}) {
  const result = await query(
    `SELECT id, type, state, payload, error, created_at, updated_at, completed_at
     FROM sagas
     WHERE state = ANY($1)
       AND updated_at < NOW() - ($2::int * INTERVAL '1 millisecond')
     ORDER BY updated_at ASC
     LIMIT $3`,
    [states, olderThan, limit]
  );

  return result.rows;
}

export async function hasProcessedSagaReply(replyId) {
  const result = await query(
    'SELECT 1 FROM processed_saga_replies WHERE reply_id = $1',
    [replyId]
  );

  return result.rowCount > 0;
}

export async function recordProcessedSagaReply({ replyId, sagaId, replyType }) {
  await query(
    `INSERT INTO processed_saga_replies (reply_id, saga_id, reply_type)
     VALUES ($1, $2, $3)
     ON CONFLICT (reply_id) DO NOTHING`,
    [replyId, sagaId, replyType]
  );
}
