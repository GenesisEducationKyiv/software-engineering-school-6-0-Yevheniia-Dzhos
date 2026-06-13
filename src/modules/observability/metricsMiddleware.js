import { recordHttpRequest } from './metrics.js';

export function createMetricsMiddleware(recordRequest) {
  return function collectMetrics(req, res, next) {
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      recordRequest(req, res, durationSeconds);
    });

    next();
  };
}

export const metricsMiddleware = createMetricsMiddleware(recordHttpRequest);
