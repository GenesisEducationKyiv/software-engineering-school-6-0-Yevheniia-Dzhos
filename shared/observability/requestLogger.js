import { randomUUID } from 'node:crypto';
import { logger } from './logger.js';

const ignoredRequestLogPaths = new Set(['/health', '/metrics']);

function getRoutePath(req) {
  if (req.route?.path) {
    const routePath = Array.isArray(req.route.path) ? req.route.path[0] : req.route.path;
    const originalPath = req.originalUrl?.split('?')[0] || '';
    const routeSegments = routePath.split('/').filter(Boolean);
    const originalSegments = originalPath.split('/').filter(Boolean);

    for (let index = 0; index <= originalSegments.length - routeSegments.length; index += 1) {
      const matches = routeSegments.every((segment, offset) => {
        return segment.startsWith(':') || segment === originalSegments[index + offset];
      });

      if (matches) {
        return `/${[
          ...originalSegments.slice(0, index),
          ...routeSegments
        ].join('/')}`;
      }
    }

    return `${req.baseUrl || ''}${routePath}`;
  }

  return 'unknown';
}

export function createRequestLogger(requestLoggerInstance) {
  return function logRequest(req, res, next) {
    const startedAt = process.hrtime.bigint();
    const requestId = req.get('x-request-id') || randomUUID();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    res.on('finish', () => {
      if (ignoredRequestLogPaths.has(req.path)) return;

      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

      requestLoggerInstance[level]('HTTP request completed', {
        requestId,
        method: req.method,
        path: getRoutePath(req),
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
