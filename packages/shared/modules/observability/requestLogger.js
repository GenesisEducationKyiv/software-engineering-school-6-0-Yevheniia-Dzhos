import { randomUUID } from 'node:crypto';
import { logger } from './logger.js';

export function createRequestLogger(requestLoggerInstance) {
  return function logRequest(req, res, next) {
    const startedAt = process.hrtime.bigint();
    const requestId = req.get('x-request-id') || randomUUID();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

      requestLoggerInstance[level]('HTTP request completed', {
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs),
        userAgent: req.get('user-agent'),
        remoteAddress: req.ip
      });
    });

    next();
  };
}

export const requestLogger = createRequestLogger(logger);
