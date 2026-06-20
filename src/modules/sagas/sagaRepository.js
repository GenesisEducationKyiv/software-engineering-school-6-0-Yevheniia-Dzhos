import { query } from '../../db/client.js';

export async function createSaga({ id, type, state, payload }) {
  const result = await query(
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

export async function updateSagaState(
  id,
  state,
  { payload, error, completed = false, expectedState } = {}
) {
  const result = await query(
    `UPDATE sagas
     SET state = $2,
         payload = COALESCE($3, payload),
         error = COALESCE($4, error),
         updated_at = NOW(),
         completed_at = CASE WHEN $5 THEN NOW() ELSE completed_at END
     WHERE id = $1
       AND ($6::text IS NULL OR state = $6)
     RETURNING *`,
    [id, state, payload, error, completed, expectedState ?? null]
  );

  return result.rows[0] || null;
}

export async function listRecentSagas(limit = 20) {
  const result = await query(
    `SELECT id, type, state, payload, error, created_at, updated_at, completed_at
     FROM sagas
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
}
