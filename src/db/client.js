import { createDatabasePool } from '@notifier/shared/modules/database/pool.js';
import { logger } from '@notifier/shared/modules/observability/index.js';
import { env } from '../config/env.js';

export const { pool, query } = createDatabasePool({
  connectionString: env.databaseUrl,
  logger
});

export async function withTransaction(work) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
