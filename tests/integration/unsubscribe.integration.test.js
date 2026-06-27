import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { setupIntegrationApp } from '../helpers/integrationApp.mjs';
import { createSubscription } from '../helpers/subscriptionTestHelpers.mjs';

const integration = setupIntegrationApp();

describe('unsubscribe endpoint', () => {
  it('GET /api/unsubscribe/:token unsubscribes and hides the subscription from lists', async () => {
    const email = integration.uniqueEmail('unsubscribe');
    const {
      confirm_token: confirmToken,
      unsubscribe_token: unsubscribeToken
    } = await createSubscription(integration, email);
    await request(integration.app).get(`/api/confirm/${confirmToken}`);

    const response = await request(integration.app).get(`/api/unsubscribe/${unsubscribeToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Unsubscribed successfully' });

    const list = await request(integration.app)
      .get('/api/subscriptions')
      .query({ email });
    expect(list.body).toEqual([]);
  });

  it('GET /api/unsubscribe/:token rejects invalid and unknown tokens', async () => {
    const invalid = await request(integration.app).get('/api/unsubscribe/short');
    const unknown = await request(integration.app).get('/api/unsubscribe/unknown-token-12345');

    expect(invalid.status).toBe(400);
    expect(invalid.body).toEqual({ error: 'Invalid token' });
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual({ error: 'Token not found' });
  });
});
