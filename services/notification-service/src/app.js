import express from 'express';
import { verifyDatabaseConnection } from './database.js';
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
      await Promise.all([
        verifyEmailConnection(),
        verifyDatabaseConnection()
      ]);
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'not ready' });
    }
  });

  return app;
}
