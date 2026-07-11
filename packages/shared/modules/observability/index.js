import { metricsMiddleware } from './metricsMiddleware.js';
import { requestLogger } from './requestLogger.js';
import { getMetricsContentType, renderMetrics } from './metrics.js';
import { createLogger } from './logger.js';
import { createRequestLogger } from './requestLogger.js';
import { createMetricsMiddleware } from './metricsMiddleware.js';
import { createMetrics } from './metrics.js';

export { logger } from './logger.js';
export {
  recordHttpRequest,
  recordReleaseNotificationsSent,
  recordReleaseScannerRepositoryFailure,
  recordReleaseScannerRun,
  setNotificationMessagesInFlight
} from './metrics.js';

function mountObservability(app, {
  requestLogger: requestLoggerMiddleware,
  metricsMiddleware: httpMetricsMiddleware,
  getMetricsContentType: getContentType,
  renderMetrics: render
}) {
  app.use(requestLoggerMiddleware);
  app.use(httpMetricsMiddleware);
  app.get('/metrics', async (_req, res, next) => {
    try {
      res.type(getContentType()).send(await render());
    } catch (error) {
      next(error);
    }
  });
}

export function registerObservability(app) {
  mountObservability(app, {
    requestLogger,
    metricsMiddleware,
    getMetricsContentType,
    renderMetrics
  });
}

export function createObservability(serviceName) {
  const logger = createLogger(serviceName);
  const metrics = createMetrics();
  const serviceRequestLogger = createRequestLogger(logger);
  const serviceMetricsMiddleware = createMetricsMiddleware(metrics.recordHttpRequest);

  return {
    logger,
    setNotificationMessagesInFlight: metrics.setNotificationMessagesInFlight,
    registerObservability(app) {
      mountObservability(app, {
        requestLogger: serviceRequestLogger,
        metricsMiddleware: serviceMetricsMiddleware,
        getMetricsContentType: metrics.getMetricsContentType,
        renderMetrics: metrics.renderMetrics
      });
    }
  };
}
