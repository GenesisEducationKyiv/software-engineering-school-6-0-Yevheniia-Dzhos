import dotenv from 'dotenv';
dotenv.config();

export const env = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/releases',
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
  githubToken: process.env.GITHUB_TOKEN || '',
  githubApiUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
  scanIntervalMs: Number(process.env.SCAN_INTERVAL_MS || 300000),
  smtpHost: process.env.SMTP_HOST || 'localhost',
  smtpPort: Number(process.env.SMTP_PORT || 1025),
  smtpSecure: String(process.env.SMTP_SECURE || 'false') === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  mailFrom: process.env.MAIL_FROM || 'GitHub Release Notifier <no-reply@example.com>'
};
