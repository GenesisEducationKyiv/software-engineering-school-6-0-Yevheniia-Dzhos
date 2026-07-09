import pg from 'pg';
import { logger } from '@notifier/shared/modules/observability/index.js';
import { env } from '../config/env.js';

export const pool = new pg.Pool({ connectionString: env.databaseUrl });

pool.on('error', (error) => {
  logger.error('Unexpected database pool error', { error });
});

export async function query(text, params = []) {
  return pool.query(text, params);
}
