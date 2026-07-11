import { afterEach, describe, expect, it } from 'vitest';
import {
  getBooleanEnv,
  getOptionalEnv,
  getPortEnv,
  getPositiveIntegerEnv,
  getRequiredEnv
} from '@notifier/shared/config/envParsers.js';

const names = [
  'TEST_REQUIRED',
  'TEST_OPTIONAL',
  'TEST_INTEGER',
  'TEST_PORT',
  'TEST_BOOLEAN'
];

describe('environment parsers', () => {
  afterEach(() => {
    names.forEach((name) => delete process.env[name]);
  });

  it('requires non-empty values', () => {
    expect(() => getRequiredEnv('TEST_REQUIRED')).toThrow('Missing required environment variable');
    process.env.TEST_REQUIRED = '';
    expect(() => getRequiredEnv('TEST_REQUIRED')).toThrow('Missing required environment variable');
    process.env.TEST_REQUIRED = 'value';
    expect(getRequiredEnv('TEST_REQUIRED')).toBe('value');
  });

  it('preserves explicitly empty optional values', () => {
    expect(getOptionalEnv('TEST_OPTIONAL', 'default')).toBe('default');
    process.env.TEST_OPTIONAL = '';
    expect(getOptionalEnv('TEST_OPTIONAL', 'default')).toBe('');
  });

  it('accepts only positive integers', () => {
    expect(getPositiveIntegerEnv('TEST_INTEGER', 5)).toBe(5);

    for (const value of ['0', '-1', '1.5', 'Infinity', 'abc', '']) {
      process.env.TEST_INTEGER = value;
      expect(() => getPositiveIntegerEnv('TEST_INTEGER', 5)).toThrow('must be a positive integer');
    }
  });

  it('accepts only valid ports', () => {
    process.env.TEST_PORT = '65535';
    expect(getPortEnv('TEST_PORT', 3000)).toBe(65535);
    process.env.TEST_PORT = '65536';
    expect(() => getPortEnv('TEST_PORT', 3000)).toThrow('must be a valid port');
  });

  it('accepts only explicit boolean values', () => {
    expect(getBooleanEnv('TEST_BOOLEAN', false)).toBe(false);
    process.env.TEST_BOOLEAN = 'TRUE';
    expect(getBooleanEnv('TEST_BOOLEAN', false)).toBe(true);
    process.env.TEST_BOOLEAN = 'yes';
    expect(() => getBooleanEnv('TEST_BOOLEAN', false)).toThrow('must be true or false');
  });
});
