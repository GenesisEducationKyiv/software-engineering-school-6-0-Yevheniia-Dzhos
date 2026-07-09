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

  it('renders subscription confirmation emails by template id', async () => {
    const { renderEmailTemplate } = await importTemplates();

    const result = renderEmailTemplate('subscription-confirmation', {
      token: 'confirm-token',
      repo: 'owner/repo'
    });

    expect(result.subject).toBe('Confirm subscription for owner/repo');
    expect(result.html).toContain('http://app.example.test/api/confirm/confirm-token');
    expect(result.html).toContain('owner/repo');
  });

  it('renders release notification emails by template id', async () => {
    const { renderEmailTemplate } = await importTemplates();

    const result = renderEmailTemplate('release-notification', {
      repo: 'owner/repo',
      tag: 'v1.0.0',
      unsubscribeToken: 'unsubscribe-token'
    });

    expect(result.subject).toBe('New release in owner/repo: v1.0.0');
    expect(result.html).toContain('https://github.com/owner/repo/releases/tag/v1.0.0');
    expect(result.html).toContain('http://app.example.test/api/unsubscribe/unsubscribe-token');
  });

  it('rejects unknown templates and missing template data', async () => {
    const { renderEmailTemplate } = await importTemplates();

    expect(() => renderEmailTemplate('missing-template', {}))
      .toThrow('Unknown email template: missing-template');
    expect(() => renderEmailTemplate('subscription-confirmation', { repo: 'owner/repo' }))
      .toThrow('Template subscription-confirmation requires token');
  });
});
