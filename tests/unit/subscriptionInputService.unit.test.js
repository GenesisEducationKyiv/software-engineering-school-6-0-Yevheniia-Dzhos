import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/utils/errors.js';
import {
  normalizeEmail,
  normalizeSubscriptionInput,
  validateEmail,
  validateSubscriptionInput,
  validateToken
} from '../../src/services/subscriptionInputService.js';

describe('subscription input validation', () => {
  it('normalizes subscription payloads before validation', () => {
    expect(normalizeSubscriptionInput({
      email: '  User@Example.COM ',
      repo: ' owner/repo '
    })).toEqual({
      email: 'user@example.com',
      repo: 'owner/repo'
    });
  });

  it('rejects invalid subscribe payloads with AppError', () => {
    expect(() => validateSubscriptionInput({ email: 'bad', repo: 'owner/repo' }))
      .toThrow(AppError);
    expect(() => validateSubscriptionInput({ email: 'user@example.com', repo: 'bad' }))
      .toThrow(AppError);
  });

  it('normalizes and validates emails for lookup', () => {
    const email = normalizeEmail(' USER@Example.com ');

    expect(email).toBe('user@example.com');
    expect(() => validateEmail(email)).not.toThrow();
    expect(() => validateEmail('not-email')).toThrow(AppError);
  });

  it('rejects short or missing tokens', () => {
    expect(() => validateToken('123456789')).toThrow(AppError);
    expect(() => validateToken(null)).toThrow(AppError);
  });
});
