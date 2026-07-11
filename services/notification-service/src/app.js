import express from 'express';
import { createHealthRoutes } from '@notifier/shared/modules/health/index.js';
import { verifyDatabaseConnection } from './database.js';
import { verifyEmailConnection } from './emailClient.js';
import notificationRoutes from './notificationRoutes.js';
import { registerObservability } from './observability.js';

export function createApp({
  verifyGrpcConnection = async () => {}
} = {}) {
  const app = express();

  app.use(express.json({ limit: '100kb' }));
  registerObservability(app);
  app.use(notificationRoutes);
  app.use(createHealthRoutes({
    readinessCheck: () => Promise.all([
      verifyEmailConnection(),
      verifyDatabaseConnection(),
      verifyGrpcConnection()
    ])
  }));

  return app;
}
