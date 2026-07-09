import { describe, expect, it } from 'vitest';
import { isValidEmail, isValidRepo, isValidToken } from '../../src/utils/validators.js';

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
});
