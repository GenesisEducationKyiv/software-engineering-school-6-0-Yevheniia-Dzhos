import express from 'express';
import { createHealthRoutes } from '../../../shared/health/index.js';
import { sendNotificationEmail } from './notificationService.js';
import { verifyEmailConnection } from './emailClient.js';
import { logger, registerObservability } from './observability.js';

function requireFields(body, fields) {
  return fields.every((field) => {
    return typeof body[field] === 'string' && body[field].trim().length > 0;
  });
}

export function createApp() {
  const app = express();

  registerObservability(app);
  app.use(express.json());
  app.use(createHealthRoutes({ readinessCheck: verifyEmailConnection }));

  app.post('/notifications/email', async (req, res, next) => {
    try {
      const body = req.body || {};

      if (!requireFields(body, ['to', 'templateId']) || !body.data || typeof body.data !== 'object') {
        res.status(400).json({ error: 'to, templateId and data are required' });
        return;
      }

      await sendNotificationEmail(body.to, body.templateId, body.data);
      res.status(200).json({ status: 'sent' });
    } catch (error) {
      if (error.status === 400) {
        res.status(400).json({ error: error.message });
        return;
      }

      next(error);
    }
  });

  app.use((error, req, res, _next) => {
    logger.error('Notification delivery failed', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      error
    });
    res.status(500).json({ error: 'Notification delivery failed' });
  });

  return app;
}
