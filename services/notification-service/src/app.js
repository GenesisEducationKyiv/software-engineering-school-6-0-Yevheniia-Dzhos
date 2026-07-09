import express from 'express';
import { createHealthRoutes } from '@notifier/shared/modules/health/index.js';
import { verifyDatabaseConnection } from './database.js';
import { verifyEmailConnection } from './emailClient.js';
import { registerObservability } from './observability.js';

export function createApp() {
  const app = express();

  registerObservability(app);
  app.use(createHealthRoutes({
    readinessCheck: () => Promise.all([
      verifyEmailConnection(),
      verifyDatabaseConnection()
    ])
  }));

  return app;
}
