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

  it('escapes HTML-significant characters in a malicious release tag', async () => {
    const { releaseEmailTemplate } = await importTemplates();

    const html = releaseEmailTemplate(
      'owner/repo',
      '"><img src=x onerror=alert(1)>',
      'unsubscribe-token'
    );

    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('https://github.com/owner/repo/releases/tag/%22%3E%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E');
  });

  it('escapes repository text and encodes confirmation token URLs', async () => {
    const { confirmationEmailTemplate } = await importTemplates();

    const html = confirmationEmailTemplate('confirm" token', 'owner/<repo>');

    expect(html).toContain('http://app.example.test/api/confirm/confirm%22%20token');
    expect(html).not.toContain('owner/<repo>');
    expect(html).toContain('owner/&lt;repo&gt;');
  });

  it('encodes unsubscribe token URLs', async () => {
    const { releaseEmailTemplate } = await importTemplates();

    const html = releaseEmailTemplate('owner/repo', 'v1.0.0', 'unsubscribe" token');

    expect(html).toContain('http://app.example.test/api/unsubscribe/unsubscribe%22%20token');
  });
});
