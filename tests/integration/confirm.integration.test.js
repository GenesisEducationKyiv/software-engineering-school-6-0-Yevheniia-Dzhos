import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { setupIntegrationApp } from '../helpers/integrationApp.mjs';
import { createSubscription } from '../helpers/subscriptionTestHelpers.mjs';

const integration = setupIntegrationApp();

describe('confirm endpoint', () => {
  it('GET /api/confirm/:token confirms an existing subscription', async () => {
    const email = integration.uniqueEmail('confirm');
    const { confirm_token: token } = await createSubscription(integration, email);

    const response = await request(integration.app).get(`/api/confirm/${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Subscription confirmed successfully' });

    const saved = await integration.query('SELECT confirmed FROM subscriptions WHERE email = $1', [email]);
    expect(saved.rows[0].confirmed).toBe(true);
  });

  it('GET /api/confirm/:token rejects invalid and unknown tokens', async () => {
    const invalid = await request(integration.app).get('/api/confirm/short');
    const unknown = await request(integration.app).get('/api/confirm/unknown-token-12345');

    expect(invalid.status).toBe(400);
    expect(invalid.body).toEqual({ error: 'Invalid token' });
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual({ error: 'Token not found' });
  });
});
