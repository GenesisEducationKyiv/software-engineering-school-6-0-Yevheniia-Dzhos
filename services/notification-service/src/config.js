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

function getBooleanEnv(name, defaultValue = false) {
  const value = process.env[name];

  if (!value) return defaultValue;

  return String(value).toLowerCase() === 'true';
}

export const env = {
  port: getNumberEnv('NOTIFICATION_SERVICE_PORT', 3002),
  appBaseUrl: getOptionalEnv('APP_BASE_URL', 'http://localhost:3000'),
  smtpHost: getRequiredEnv('SMTP_HOST'),
  smtpPort: getNumberEnv('SMTP_PORT', 1025),
  smtpSecure: getBooleanEnv('SMTP_SECURE', false),
  smtpUser: getOptionalEnv('SMTP_USER', ''),
  smtpPass: getOptionalEnv('SMTP_PASS', ''),
  mailFrom: getOptionalEnv(
    'MAIL_FROM',
    'GitHub Release Notifier <no-reply@example.com>'
  )
};
