import express from 'express';
import {
  sendReleaseNotification,
  sendSubscriptionConfirmation
} from './notificationService.js';
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

  app.post('/notifications/subscription-confirmation', async (req, res, next) => {
    try {
      const body = req.body || {};

      if (!requireFields(body, ['email', 'token', 'repo'])) {
        res.status(400).json({ error: 'email, token and repo are required' });
        return;
      }

      await sendSubscriptionConfirmation(body.email, body.token, body.repo);
      res.status(202).json({ status: 'accepted' });
    } catch (error) {
      next(error);
    }
  });

  app.post('/notifications/release', async (req, res, next) => {
    try {
      const body = req.body || {};

      if (!requireFields(body, ['email', 'repo', 'tag', 'unsubscribeToken'])) {
        res.status(400).json({
          error: 'email, repo, tag and unsubscribeToken are required'
        });
        return;
      }

      await sendReleaseNotification(
        body.email,
        body.repo,
        body.tag,
        body.unsubscribeToken
      );
      res.status(202).json({ status: 'accepted' });
    } catch (error) {
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
