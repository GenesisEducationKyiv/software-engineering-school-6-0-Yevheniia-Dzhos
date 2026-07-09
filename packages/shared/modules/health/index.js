import { Router } from 'express';

export function createHealthRoutes({ readinessCheck } = {}) {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/health/live', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/health/ready', async (_req, res) => {
    try {
      if (readinessCheck) {
        await readinessCheck();
      }

      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'not ready' });
    }
  });

  return router;
}
