import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

async function importTemplates() {
  vi.resetModules();

  return import('../../services/notification-service/src/emailTemplates.js');
}

describe('notification email templates', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      APP_BASE_URL: 'http://app.example.test',
      SMTP_HOST: 'mailhog'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('renders subscription confirmation emails', async () => {
    const { confirmationEmailTemplate } = await importTemplates();

    const html = confirmationEmailTemplate('confirm-token', 'owner/repo');

    expect(html).toContain('http://app.example.test/api/confirm/confirm-token');
    expect(html).toContain('owner/repo');
  });

  it('renders release notification emails', async () => {
    const { releaseEmailTemplate } = await importTemplates();

    const html = releaseEmailTemplate('owner/repo', 'v1.0.0', 'unsubscribe-token');

    expect(html).toContain('https://github.com/owner/repo/releases/tag/v1.0.0');
    expect(html).toContain('http://app.example.test/api/unsubscribe/unsubscribe-token');
  });
});
