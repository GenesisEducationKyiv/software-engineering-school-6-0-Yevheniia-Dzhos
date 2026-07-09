import { metricsMiddleware } from './metricsMiddleware.js';
import { requestLogger } from './requestLogger.js';
import { renderMetrics } from './metrics.js';
import { createLogger } from './logger.js';
import { createRequestLogger } from './requestLogger.js';
import { createMetricsMiddleware } from './metricsMiddleware.js';
import { createMetrics } from './metrics.js';

export { logger } from './logger.js';

export function registerObservability(app) {
  app.use(requestLogger);
  app.use(metricsMiddleware);
  app.get('/metrics', (_req, res) => {
    res.type('text/plain; version=0.0.4; charset=utf-8').send(renderMetrics());
  });
}

export function createObservability(serviceName) {
  const logger = createLogger(serviceName);
  const metrics = createMetrics();
  const requestLogger = createRequestLogger(logger);
  const metricsMiddleware = createMetricsMiddleware(metrics.recordHttpRequest);

  return {
    logger,
    setGauge: metrics.setGauge,
    registerObservability(app) {
      app.use(requestLogger);
      app.use(metricsMiddleware);
      app.get('/metrics', (_req, res) => {
        res.type('text/plain; version=0.0.4; charset=utf-8').send(metrics.renderMetrics());
      });
    }
  };
}
