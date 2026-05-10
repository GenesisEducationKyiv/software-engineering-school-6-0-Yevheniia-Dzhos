import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  const migrationPath = path.join(
    __dirname,
    'migrations',
    '001_init.sql'
  );

  const sql = await fs.readFile(migrationPath, 'utf8');

  await query(sql);
}