import { logger } from '../utils/logger.js';
import { getRequestRoute } from '../utils/requestRoute.js';

function getErrorLogLevel(status) {
  if (status >= 500) return 'error';
  if (status >= 400) return 'warn';
  return 'info';
}

export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  const logLevel = getErrorLogLevel(status);

  logger[logLevel]('Request failed', {
    requestId: req.requestId,
    method: req.method,
    path: getRequestRoute(req),
    statusCode: status,
    error: err
  });

  res.status(status).json({ error: message });
}
