import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

async function createTestApp({ sagaApiToken = '' } = {}) {
  vi.resetModules();
  vi.doMock('../../src/config/env.js', () => ({
    env: { sagaApiToken }
  }));
  vi.doMock('../../src/modules/sagas/sagaController.js', () => ({
    listSagas: vi.fn((_req, res) => res.status(200).json([{ id: 'saga-1' }])),
    getSaga: vi.fn((_req, res) => res.status(200).json({ id: 'saga-1' }))
  }));

  const { default: sagaRoutes } = await import('../../src/modules/sagas/sagaRoutes.js');
  const { errorHandler } = await import('../../src/middleware/errorHandler.js');
  const app = express();
  app.use('/api', sagaRoutes);
  app.use(errorHandler);
  return app;
}

describe('saga routes', () => {
  afterEach(() => {
    vi.doUnmock('../../src/config/env.js');
    vi.doUnmock('../../src/modules/sagas/sagaController.js');
  });

  it('allows saga monitoring when no API token is configured', async () => {
    const app = await createTestApp();

    const response = await request(app).get('/api/sagas');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 'saga-1' }]);
  });

  it('rejects saga monitoring without a configured API token', async () => {
    const app = await createTestApp({ sagaApiToken: 'secret-token' });

    const response = await request(app).get('/api/sagas');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Saga API token required' });
  });

  it('accepts saga monitoring with x-saga-api-token', async () => {
    const app = await createTestApp({ sagaApiToken: 'secret-token' });

    const response = await request(app)
      .get('/api/sagas')
      .set('x-saga-api-token', 'secret-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 'saga-1' }]);
  });

  it('accepts saga monitoring with bearer token', async () => {
    const app = await createTestApp({ sagaApiToken: 'secret-token' });

    const response = await request(app)
      .get('/api/sagas/saga-1')
      .set('authorization', 'Bearer secret-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 'saga-1' });
  });
});
