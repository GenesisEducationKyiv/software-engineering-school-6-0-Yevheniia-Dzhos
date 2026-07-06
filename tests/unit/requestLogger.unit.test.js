import { describe, expect, it, vi } from 'vitest';

import { requestLogger } from '../../src/middleware/requestLogger.js';
import { logger } from '../../src/utils/logger.js';

function createResponse() {
  const listeners = new Map();

  return {
    statusCode: 200,
    setHeader: vi.fn(),
    on: vi.fn((event, listener) => {
      listeners.set(event, listener);
    }),
    finish() {
      listeners.get('finish')();
    }
  };
}

describe('request logger', () => {
  it.each(['/health', '/metrics'])('does not write logs for noisy probe path %s', (path) => {
    const req = {
      path,
      method: 'GET',
      route: { path },
      originalUrl: path,
      baseUrl: '',
      get: vi.fn(() => undefined)
    };
    const res = createResponse();
    const next = vi.fn();
    const info = vi.spyOn(logger, 'info').mockImplementation(() => {});

    requestLogger(req, res, next);
    res.finish();

    expect(next).toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });
});
