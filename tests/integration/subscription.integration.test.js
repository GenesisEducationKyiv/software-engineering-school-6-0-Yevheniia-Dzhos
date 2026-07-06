import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { setupIntegrationApp } from '../helpers/integrationApp.mjs';

const integration = setupIntegrationApp();

describe('subscription API', () => {
  it('POST /api/subscribe validates bad input', async () => {
    const response = await request(integration.app)
      .post('/api/subscribe')
      .send({ email: 'bad', repo: 'bad' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid email' });
  });

  it('POST /api/subscribe creates a pending subscription and sends confirmation mail', async () => {
    const email = integration.uniqueEmail('pending');
    const repo = integration.uniqueRepo('pending');

    const response = await request(integration.app)
      .post('/api/subscribe')
      .send({ email, repo });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Subscription successful. Confirmation email sent.');

    const saved = await integration.query(
      `SELECT s.email, s.confirmed, r.full_name, r.last_seen_tag
       FROM subscriptions s
       JOIN repositories r ON r.id = s.repository_id
       WHERE s.email = $1`,
      [email]
    );

    expect(saved.rows).toHaveLength(1);
    expect(saved.rows[0]).toMatchObject({
      email,
      confirmed: false,
      full_name: repo,
      last_seen_tag: 'v1.0.0'
    });
  });

  it('POST /api/subscribe returns 404 for unknown repositories', async () => {
    const response = await request(integration.app)
      .post('/api/subscribe')
      .send({ email: integration.uniqueEmail('missing'), repo: 'missing/repo' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Repository not found' });
  });
});
