import express from 'express';
import cors from 'cors';
import path from 'node:path';
import swaggerUi from 'swagger-ui-express';
import { fileURLToPath } from 'node:url';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { metricsMiddleware } from './middleware/metricsMiddleware.js';
import { requestLogger } from './middleware/requestLogger.js';
import { loadSwaggerDocument } from './config/swagger.js';
import { renderMetrics } from './utils/metrics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  const swaggerDocument = loadSwaggerDocument();

  app.use(cors());
  app.use(requestLogger);
  app.use(metricsMiddleware);
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use('/api', subscriptionRoutes);
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/metrics', (_req, res) => {
    res.type('text/plain; version=0.0.4; charset=utf-8').send(renderMetrics());
  });
  app.use(errorHandler);

  return app;
}
