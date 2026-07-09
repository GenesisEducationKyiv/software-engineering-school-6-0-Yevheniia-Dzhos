import { AppError } from '@notifier/shared/utils/errors.js';
import { logger } from '@notifier/shared/modules/observability/index.js';

export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const message = err instanceof AppError ? err.message : 'Internal Server Error';

  const logLevel = status >= 500 ? 'error' : 'warn';

  logger[logLevel]('Request failed', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode: status,
    error: err
  });

  res.status(status).json({ error: message });
}