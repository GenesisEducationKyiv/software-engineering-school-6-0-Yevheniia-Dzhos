import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { setupIntegrationApp } from '../helpers/integrationApp.mjs';
import { createSubscription } from '../helpers/subscriptionTestHelpers.mjs';

const integration = setupIntegrationApp();

describe('subscriptions endpoint', () => {
  it('GET /api/subscriptions lists active subscriptions for an email', async () => {
    const email = integration.uniqueEmail('list');
    const repo = integration.uniqueRepo('list');
    const { confirm_token: token } = await createSubscription(integration, email, repo);
    await request(integration.app).get(`/api/confirm/${token}`);

    const response = await request(integration.app)
      .get('/api/subscriptions')
      .query({ email: ` ${email.toUpperCase()} ` });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        email,
        repo,
        confirmed: true,
        last_seen_tag: 'v1.0.0'
      }
    ]);
  });

  it('GET /api/subscriptions validates email query', async () => {
    const response = await request(integration.app)
      .get('/api/subscriptions')
      .query({ email: 'not-email' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid email' });
  });
});
