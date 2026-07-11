import { describe, expect, it, vi } from 'vitest';

import { logger } from '@notifier/shared/modules/observability/logger.js';
import { requestLogger } from '@notifier/shared/modules/observability/requestLogger.js';

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

function createRequest({ path = '/api/subscribe', statusCode = 200, headers = {} } = {}) {
  return {
    path,
    method: 'POST',
    route: { path },
    originalUrl: path,
    baseUrl: '',
    ip: '127.0.0.1',
    get: vi.fn((header) => headers[header.toLowerCase()]),
    __statusCode: statusCode
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

  it('generates a request id and echoes it back on the response header', () => {
    const req = createRequest();
    const res = createResponse();
    res.statusCode = 200;
    vi.spyOn(logger, 'info').mockImplementation(() => {});

    requestLogger(req, res, vi.fn());

    expect(req.requestId).toEqual(expect.any(String));
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', req.requestId);
  });

  it('reuses an incoming x-request-id header instead of generating a new one', () => {
    const req = createRequest({ headers: { 'x-request-id': 'client-supplied-id' } });
    const res = createResponse();
    vi.spyOn(logger, 'info').mockImplementation(() => {});

    requestLogger(req, res, vi.fn());

    expect(req.requestId).toBe('client-supplied-id');
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'client-supplied-id');
  });

  it.each([
    [200, 'info'],
    [404, 'warn'],
    [500, 'error']
  ])('logs status %i at %s level', (statusCode, level) => {
    const req = createRequest();
    const res = createResponse();
    res.statusCode = statusCode;
    const spy = vi.spyOn(logger, level).mockImplementation(() => {});

    requestLogger(req, res, vi.fn());
    res.finish();

    expect(spy).toHaveBeenCalledWith('HTTP request completed', expect.objectContaining({
      statusCode,
      method: 'POST',
      path: '/api/subscribe'
    }));
  });
});
