import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { setupIntegrationApp } from '../helpers/integrationApp.mjs';

const integration = setupIntegrationApp();

describe('health endpoint', () => {
  it('GET /health returns service status', async () => {
    const response = await request(integration.app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
