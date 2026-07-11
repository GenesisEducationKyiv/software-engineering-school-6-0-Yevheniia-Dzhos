import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@notifier/shared/utils/errors.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';

function createResponse() {
  const res = {
    statusCode: undefined,
    body: undefined
  };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body) => {
    res.body = body;
    return res;
  });
  return res;
}

describe('errorHandler', () => {
  it('returns the AppError status and message', () => {
    const res = createResponse();
    const error = new AppError(404, 'Repository not found');

    errorHandler(error, { requestId: 'r1', method: 'GET', originalUrl: '/api/x' }, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Repository not found' });
  });

  it('masks a non-AppError message with a generic response, even if it has a status', () => {
    const res = createResponse();
    const error = new Error('connection refused to postgres://user:pass@internal-db:5432');
    error.status = 502;

    errorHandler(error, { requestId: 'r2', method: 'GET', originalUrl: '/api/y' }, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    expect(JSON.stringify(res.body)).not.toContain('postgres://user:pass@internal-db:5432');
  });

  it('defaults to 500 when a non-AppError has no status', () => {
    const res = createResponse();
    const error = new Error('unexpected failure');

    errorHandler(error, { requestId: 'r3', method: 'POST', originalUrl: '/api/z' }, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
  });

  it('logs the full error internally even when the response message is masked', async () => {
    vi.resetModules();
    vi.doMock('@notifier/shared/modules/observability/index.js', () => ({
      logger: { error: vi.fn(), warn: vi.fn() }
    }));

    const { errorHandler: freshErrorHandler } = await import('../../src/middleware/errorHandler.js');
    const { logger } = await import('@notifier/shared/modules/observability/index.js');
    const res = createResponse();
    const error = new Error('raw internal detail');

    freshErrorHandler(
      error,
      { requestId: 'r4', method: 'GET', originalUrl: '/api/w' },
      res,
      vi.fn()
    );

    expect(logger.error).toHaveBeenCalledWith('Request failed', expect.objectContaining({
      requestId: 'r4',
      method: 'GET',
      path: '/api/w',
      statusCode: 500,
      error
    }));

    vi.doUnmock('@notifier/shared/modules/observability/index.js');
  });

  it('logs at warn level for 4xx and error level for 5xx', async () => {
    vi.resetModules();
    vi.doMock('@notifier/shared/modules/observability/index.js', () => ({
      logger: { error: vi.fn(), warn: vi.fn() }
    }));

    const { errorHandler: freshErrorHandler } = await import('../../src/middleware/errorHandler.js');
    const { logger } = await import('@notifier/shared/modules/observability/index.js');

    freshErrorHandler(
      new AppError(400, 'Invalid email'),
      { requestId: 'r5', method: 'POST', originalUrl: '/api/subscribe' },
      createResponse(),
      vi.fn()
    );
    freshErrorHandler(
      new AppError(500, 'boom'),
      { requestId: 'r6', method: 'POST', originalUrl: '/api/subscribe' },
      createResponse(),
      vi.fn()
    );

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);

    vi.doUnmock('@notifier/shared/modules/observability/index.js');
  });
});
