import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createHealthRoutes } from '@notifier/shared/modules/health/index.js';

function createApp(readinessCheck) {
  const app = express();

  app.use(createHealthRoutes({ readinessCheck }));

  return app;
}

describe('health routes', () => {
  it('reports liveness without calling readiness dependencies', async () => {
    const readinessCheck = vi.fn();
    const app = createApp(readinessCheck);

    const health = await request(app).get('/health');
    const live = await request(app).get('/health/live');

    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: 'ok' });
    expect(live.status).toBe(200);
    expect(live.body).toEqual({ status: 'ok' });
    expect(readinessCheck).not.toHaveBeenCalled();
  });

  it('reports readiness from the configured dependency check', async () => {
    const readinessCheck = vi.fn();
    const app = createApp(readinessCheck);

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready' });
    expect(readinessCheck).toHaveBeenCalledOnce();
  });

  it('returns 503 when the readiness check fails', async () => {
    const app = createApp(vi.fn().mockRejectedValue(new Error('dependency unavailable')));

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'not ready' });
  });
});
