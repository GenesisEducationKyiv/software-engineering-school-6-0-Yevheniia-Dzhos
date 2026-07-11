import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLogger, logger } from '@notifier/shared/modules/observability/logger.js';

const originalLogLevel = process.env.LOG_LEVEL;

afterEach(() => {
  process.env.LOG_LEVEL = originalLogLevel;
  vi.restoreAllMocks();
});

describe('logger', () => {
  it('redacts sensitive context fields before writing logs', () => {
    process.env.LOG_LEVEL = 'debug';
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    logger.info('User subscribed', {
      email: 'user@example.com',
      token: 'confirm-token',
      nested: {
        smtpPass: 'smtp-password',
        repository: 'octocat/Hello-World'
      }
    });

    const entry = JSON.parse(stdout.mock.calls[0][0]);

    expect(entry.email).toBe('user@example.com');
    expect(entry.token).toBe('[REDACTED]');
    expect(entry.nested.smtpPass).toBe('[REDACTED]');
    expect(entry.nested.repository).toBe('octocat/Hello-World');
    expect(stdout.mock.calls[0][0]).not.toContain('confirm-token');
    expect(stdout.mock.calls[0][0]).not.toContain('smtp-password');
  });

  it('redacts sensitive fields attached to a logged error object', () => {
    process.env.LOG_LEVEL = 'debug';
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const error = new Error('SMTP authentication failed');
    error.config = { password: 'super-secret', host: 'smtp.example.com' };

    logger.error('Email delivery failed', { error });

    const entry = JSON.parse(stderr.mock.calls[0][0]);

    expect(entry.error.message).toBe('SMTP authentication failed');
    expect(entry.error.config.password).toBe('[REDACTED]');
    expect(entry.error.config.host).toBe('smtp.example.com');
    expect(stderr.mock.calls[0][0]).not.toContain('super-secret');
  });

  it('writes error-level logs to stderr and info-level logs to stdout', () => {
    process.env.LOG_LEVEL = 'debug';
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    logger.info('all good');
    logger.error('something broke');

    expect(stdout).toHaveBeenCalledTimes(1);
    expect(stderr).toHaveBeenCalledTimes(1);
    expect(JSON.parse(stdout.mock.calls[0][0]).message).toBe('all good');
    expect(JSON.parse(stderr.mock.calls[0][0]).message).toBe('something broke');
  });

  it('suppresses log levels below the configured LOG_LEVEL threshold', () => {
    process.env.LOG_LEVEL = 'warn';
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const scopedLogger = createLogger('test-service');
    scopedLogger.debug('too quiet to log');
    scopedLogger.info('also too quiet to log');
    scopedLogger.warn('loud enough to log');

    expect(stderr).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledTimes(1);
    expect(JSON.parse(stdout.mock.calls[0][0]).message).toBe('loud enough to log');
  });
});
