import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const testsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

dotenv.config({ path: path.join(testsDir, '.env.test') });

export function buildTestEnv(overrides = {}) {
  return {
    DATABASE_URL: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:55432/releases_test',
    SMTP_HOST: process.env.SMTP_HOST || 'localhost',
    SMTP_PORT: process.env.SMTP_PORT || '11025',
    APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:3000',
    SCAN_INTERVAL_MS: process.env.SCAN_INTERVAL_MS || '600000',
    E2E_PORT: process.env.E2E_PORT || '3310',
    ...overrides
  };
}

export function applyTestEnv(overrides = {}) {
  const env = buildTestEnv(overrides);
  Object.assign(process.env, env);
  return env;
}
