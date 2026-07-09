import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerUi from 'swagger-ui-express';
import { createSubscriptionRoutes } from './modules/subscriptions/index.js';
import { trackRepository } from './modules/releaseTracking/index.js';
import { registerObservability } from '@notifier/shared/modules/observability/index.js';
import { healthRoutes } from './modules/health/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { loadSwaggerDocument } from './config/swagger.js';

const publicDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');

export function createApp() {
  const app = express();
  const swaggerDocument = loadSwaggerDocument();

  app.use(cors());
  registerObservability(app);
  app.use(express.json());
  app.use(express.static(publicDirectory));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use('/api', createSubscriptionRoutes({ trackRepository }));
  app.use(healthRoutes);
  app.use(errorHandler);

  return app;
}
