import { metricsMiddleware } from './metricsMiddleware.js';
import { requestLogger } from './requestLogger.js';
import { renderMetrics } from './metrics.js';

export { logger } from './logger.js';

export function registerObservability(app) {
  app.use(requestLogger);
  app.use(metricsMiddleware);
  app.get('/metrics', (_req, res) => {
    res.type('text/plain; version=0.0.4; charset=utf-8').send(renderMetrics());
  });
}
