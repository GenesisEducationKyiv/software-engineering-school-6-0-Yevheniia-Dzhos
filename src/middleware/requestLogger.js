import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger.js';
import { getRequestRoute } from '../utils/requestRoute.js';

export function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();
  const requestId = req.get('x-request-id') || randomUUID();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger[level]('HTTP request completed', {
      requestId,
      method: req.method,
      path: getRequestRoute(req),
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
      userAgent: req.get('user-agent'),
      remoteAddress: req.ip
    });
  });

  next();
}