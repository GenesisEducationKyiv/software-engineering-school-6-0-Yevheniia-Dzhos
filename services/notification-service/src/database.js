import pg from 'pg';
import { env } from './config.js';

export const pool = new pg.Pool({ connectionString: env.databaseUrl });

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function verifyDatabaseConnection() {
  await query('SELECT 1');
}
