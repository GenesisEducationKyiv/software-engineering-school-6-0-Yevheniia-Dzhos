import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { subscriptionRoutes } from './modules/subscriptions/index.js';
import { registerObservability } from './modules/observability/index.js';
import { healthRoutes } from './modules/health/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { loadSwaggerDocument } from './config/swagger.js';

export function createApp() {
  const app = express();
  const swaggerDocument = loadSwaggerDocument();

  app.use(cors());
  registerObservability(app);
  app.use(express.json());
  app.use(express.static('src/public'));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use('/api', subscriptionRoutes);
  app.use(healthRoutes);
  app.use(errorHandler);

  return app;
}
