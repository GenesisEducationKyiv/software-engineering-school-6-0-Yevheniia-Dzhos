import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../src/modules/observability/logger.js';

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
});
