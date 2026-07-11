import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  const migrationsDirectory = path.join(__dirname, 'migrations');
  const migrationFiles = (await fs.readdir(migrationsDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const migrationFile of migrationFiles) {
    const alreadyApplied = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE filename = $1',
      [migrationFile]
    );

    if (alreadyApplied.rowCount > 0) {
      continue;
    }

    const migrationPath = path.join(migrationsDirectory, migrationFile);
    const sql = await fs.readFile(migrationPath, 'utf8');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations(filename) VALUES ($1)',
        [migrationFile]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
