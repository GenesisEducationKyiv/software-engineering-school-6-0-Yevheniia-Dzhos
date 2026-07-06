import { metricsMiddleware } from './metricsMiddleware.js';
import { requestLogger } from './requestLogger.js';
import { getMetricsContentType, renderMetrics } from './metrics.js';
import { createLogger } from './logger.js';
import { createRequestLogger } from './requestLogger.js';
import { createMetricsMiddleware } from './metricsMiddleware.js';
import { createMetrics } from './metrics.js';

export { logger } from './logger.js';

export function registerObservability(app) {
  app.use(requestLogger);
  app.use(metricsMiddleware);
  app.get('/metrics', async (_req, res, next) => {
    try {
      res.type(getMetricsContentType()).send(await renderMetrics());
    } catch (error) {
      next(error);
    }
  });
}

export function createObservability(serviceName) {
  const logger = createLogger(serviceName);
  const metrics = createMetrics();
  const requestLogger = createRequestLogger(logger);
  const metricsMiddleware = createMetricsMiddleware(metrics.recordHttpRequest);

  return {
    logger,
    registerObservability(app) {
      app.use(requestLogger);
      app.use(metricsMiddleware);
      app.get('/metrics', async (_req, res, next) => {
        try {
          res.type(metrics.getMetricsContentType()).send(await metrics.renderMetrics());
        } catch (error) {
          next(error);
        }
      });
    }
  };
}
