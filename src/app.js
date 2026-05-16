import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { loadSwaggerDocument } from './config/swagger.js';

export function createApp() {
  const app = express();
  const swaggerDocument = loadSwaggerDocument();

  app.use(cors());
  app.use(express.json());
  app.use(express.static('src/public'));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use('/api', subscriptionRoutes);
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use(errorHandler);

  return app;
}