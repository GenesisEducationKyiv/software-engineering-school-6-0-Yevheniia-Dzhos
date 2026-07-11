import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerUi from 'swagger-ui-express';
import { createSubscriptionRoutes } from './modules/subscriptions/index.js';
import { trackRepository } from './modules/releaseTracking/index.js';
import { sagaRoutes } from './modules/sagas/index.js';
import { registerObservability } from '@notifier/shared/modules/observability/index.js';
import { healthRoutes } from './modules/health/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { loadSwaggerDocument } from './config/swagger.js';

const publicDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');

export function createApp() {
  const app = express();
  const swaggerDocument = loadSwaggerDocument();

  registerObservability(app);
  app.use(express.json({ limit: '100kb' }));
  app.use(express.static(publicDirectory));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  const apiRouter = express.Router();
  apiRouter.use(createSubscriptionRoutes({ trackRepository }));
  apiRouter.use(sagaRoutes);
  app.use('/api', apiRouter);
  app.use(healthRoutes);
  app.use(errorHandler);

  return app;
}
