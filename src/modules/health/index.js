import { Router } from 'express';
import { query } from '../../db/client.js';

export const healthRoutes = Router();

healthRoutes.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

healthRoutes.get('/health/live', (_req, res) => {
  res.json({ status: 'ok' });
});

healthRoutes.get('/health/ready', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not ready' });
  }
});
