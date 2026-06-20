import dotenv from 'dotenv';
import {
  getBooleanEnv,
  getOptionalEnv,
  getPortEnv,
  getRequiredEnv
} from '@notifier/shared/config/envParsers.js';
import { getMessagingEnv } from '@notifier/shared/config/messagingEnv.js';

dotenv.config();

export const env = {
  port: getPortEnv('NOTIFICATION_SERVICE_PORT', 3002),
  grpcPort: getPortEnv('NOTIFICATION_SERVICE_GRPC_PORT', 3003),
  databaseUrl: getRequiredEnv('DATABASE_URL'),
  ...getMessagingEnv(),
  appBaseUrl: getOptionalEnv('APP_BASE_URL', 'http://localhost:3000'),
  smtpHost: getRequiredEnv('SMTP_HOST'),
  smtpPort: getPortEnv('SMTP_PORT', 1025),
  smtpSecure: getBooleanEnv('SMTP_SECURE', false),
  smtpUser: getOptionalEnv('SMTP_USER', ''),
  smtpPass: getOptionalEnv('SMTP_PASS', ''),
  mailFrom: getOptionalEnv(
    'MAIL_FROM',
    'GitHub Release Notifier <no-reply@example.com>'
  )
};

if (env.smtpUser && !env.smtpPass) {
  throw new Error('SMTP_PASS is required when SMTP_USER is set');
}
