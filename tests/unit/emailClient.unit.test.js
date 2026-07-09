import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nodemailerMock = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
  verify: vi.fn()
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: nodemailerMock.createTransport
  }
}));

const originalEnv = { ...process.env };

async function importEmailClient() {
  vi.resetModules();
  nodemailerMock.createTransport.mockReturnValue({
    sendMail: nodemailerMock.sendMail,
    verify: nodemailerMock.verify
  });

  return import('../../services/notification-service/src/emailClient.js');
}

describe('notification email client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      SMTP_HOST: 'mailhog',
      SMTP_PORT: '1025',
      SMTP_SECURE: 'false',
      SMTP_USER: 'smtp-user',
      SMTP_PASS: 'smtp-pass',
      MAIL_FROM: 'Notifier <no-reply@example.com>'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('creates a nodemailer transport from notification service env', async () => {
    await importEmailClient();

    expect(nodemailerMock.createTransport).toHaveBeenCalledWith({
      host: 'mailhog',
      port: 1025,
      secure: false,
      auth: {
        user: 'smtp-user',
        pass: 'smtp-pass'
      }
    });
  });

  it('sends email through the configured transport', async () => {
    const { sendEmail } = await importEmailClient();

    await sendEmail({
      to: 'user@example.com',
      subject: 'Confirm',
      html: '<p>Hello</p>'
    });

    expect(nodemailerMock.sendMail).toHaveBeenCalledWith({
      from: 'Notifier <no-reply@example.com>',
      to: 'user@example.com',
      subject: 'Confirm',
      html: '<p>Hello</p>'
    });
  });

  it('verifies the configured SMTP connection', async () => {
    const { verifyEmailConnection } = await importEmailClient();

    await verifyEmailConnection();

    expect(nodemailerMock.verify).toHaveBeenCalledOnce();
  });
});
