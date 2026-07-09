import pg from 'pg';
import { env } from './config.js';
import { logger } from './observability.js';

export const pool = new pg.Pool({ connectionString: env.databaseUrl });

pool.on('error', (error) => {
  logger.error('Unexpected database pool error', { error });
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function verifyDatabaseConnection() {
  await query('SELECT 1');
}
