import { createDatabasePool } from '@notifier/shared/modules/database/pool.js';
import { env } from './config.js';
import { logger } from './observability.js';

export const { pool, query } = createDatabasePool({
  connectionString: env.databaseUrl,
  logger
});

export async function verifyDatabaseConnection() {
  await query('SELECT 1');
}
