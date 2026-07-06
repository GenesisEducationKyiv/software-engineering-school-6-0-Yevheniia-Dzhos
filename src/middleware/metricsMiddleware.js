import { recordHttpRequest } from '../utils/metrics.js';

export function metricsMiddleware(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    recordHttpRequest(req, res, durationSeconds);
  });

  next();
}