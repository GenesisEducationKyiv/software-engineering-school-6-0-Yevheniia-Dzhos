import dotenv from 'dotenv';
import {
  getOptionalEnv,
  getPortEnv,
  getPositiveIntegerEnv,
  getRequiredEnv
} from './envParsers.js';
import { getMessagingEnv } from './messagingEnv.js';

dotenv.config();

export const env = {
  port: getPortEnv('PORT', 3000),
  databaseUrl: getRequiredEnv('DATABASE_URL'),
  ...getMessagingEnv(),
  notificationServiceUrl: getOptionalEnv(
    'NOTIFICATION_SERVICE_URL',
    'http://localhost:3002'
  ),

  githubToken: getOptionalEnv('GITHUB_TOKEN', ''),
  githubApiUrl: getOptionalEnv('GITHUB_API_URL', 'https://api.github.com'),
  githubRequestTimeoutMs: getPositiveIntegerEnv('GITHUB_REQUEST_TIMEOUT_MS', 10000),

  scanIntervalMs: getPositiveIntegerEnv('SCAN_INTERVAL_MS', 300000),
  scanChunkSize: getPositiveIntegerEnv('SCAN_CHUNK_SIZE', 5),
  notificationRequestTimeoutMs: getPositiveIntegerEnv('NOTIFICATION_REQUEST_TIMEOUT_MS', 10000)
};