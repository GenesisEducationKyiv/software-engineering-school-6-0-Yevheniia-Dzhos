import { describe, expect, it } from 'vitest';
import {
  isValidEmail,
  isValidRepo,
  isValidToken,
  validateSubscriptionConfirmationRequest
} from '@notifier/shared/utils/validators.js';

describe('validators', () => {
  it.each([
    ['user@example.com', true],
    ['bad-email', false],
    ['', false]
  ])('validates email value %s', (email, expected) => {
    expect(isValidEmail(email)).toBe(expected);
  });

  it.each([
    ['owner.name/repo-name_1', true],
    ['owner/repo', true],
    ['bad', false],
    ['owner/', false]
  ])('validates repository value %s', (repo, expected) => {
    expect(isValidRepo(repo)).toBe(expected);
  });

  it.each([
    ['1234567890', true],
    ['123456789', false],
    [null, false]
  ])('validates token value %s', (token, expected) => {
    expect(isValidToken(token)).toBe(expected);
  });

  describe('validateSubscriptionConfirmationRequest', () => {
    it('returns null for a fully valid request', () => {
      expect(validateSubscriptionConfirmationRequest({
        email: 'user@example.com',
        token: '1234567890',
        repo: 'owner/repo'
      })).toBeNull();
    });

    it('reports the first invalid field in email, token, repo order', () => {
      expect(validateSubscriptionConfirmationRequest({
        email: 'bad-email',
        token: 'short',
        repo: 'bad'
      })).toBe('Invalid or missing field: email');

      expect(validateSubscriptionConfirmationRequest({
        email: 'user@example.com',
        token: 'short',
        repo: 'bad'
      })).toBe('Invalid or missing field: token');

      expect(validateSubscriptionConfirmationRequest({
        email: 'user@example.com',
        token: '1234567890',
        repo: 'bad'
      })).toBe('Invalid or missing field: repo');
    });

    it('treats a missing request body as fully invalid', () => {
      expect(validateSubscriptionConfirmationRequest())
        .toBe('Invalid or missing field: email');
    });
  });
});
