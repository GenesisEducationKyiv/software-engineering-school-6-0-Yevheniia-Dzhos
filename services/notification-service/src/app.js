import express from 'express';
import { verifyEmailConnection } from './emailClient.js';
import { registerObservability } from './observability.js';

export function createApp() {
  const app = express();

  registerObservability(app);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/health/ready', async (_req, res) => {
    try {
      await verifyEmailConnection();
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'not ready' });
    }
  });

  return app;
}
