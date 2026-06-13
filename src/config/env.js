import dotenv from 'dotenv';
dotenv.config();

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOptionalEnv(name, defaultValue) {
  return process.env[name] || defaultValue;
}

function getNumberEnv(name, defaultValue) {
  const value = process.env[name];

  if (!value) return defaultValue;

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }

  return parsed;
}

function getPositiveIntegerEnv(name, defaultValue) {
  const value = getNumberEnv(name, defaultValue);

  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Environment variable ${name} must be a positive integer`);
  }

  return value;
}

export const env = {
  port: getNumberEnv('PORT', 3000),
  databaseUrl: getRequiredEnv('DATABASE_URL'),
  notificationServiceUrl: getOptionalEnv(
    'NOTIFICATION_SERVICE_URL',
    'http://localhost:3002'
  ),

  githubToken: getOptionalEnv('GITHUB_TOKEN', ''),
  githubApiUrl: getOptionalEnv('GITHUB_API_URL', 'https://api.github.com'),
  githubRequestTimeoutMs: getPositiveIntegerEnv('GITHUB_REQUEST_TIMEOUT_MS', 10000),

  scanIntervalMs: getNumberEnv('SCAN_INTERVAL_MS', 300000),
  scanChunkSize: getNumberEnv('SCAN_CHUNK_SIZE', 5),
  notificationRequestTimeoutMs: getPositiveIntegerEnv('NOTIFICATION_REQUEST_TIMEOUT_MS', 10000)
};