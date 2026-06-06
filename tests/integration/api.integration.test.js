process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:55432/releases_test';
process.env.SMTP_HOST = process.env.SMTP_HOST || 'localhost';
process.env.SMTP_PORT = process.env.SMTP_PORT || '11025';
process.env.APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
process.env.SCAN_INTERVAL_MS = process.env.SCAN_INTERVAL_MS || '600000';

import http from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

let app;
let pool;
let query;
let githubServer;
let notificationServer;

function createGithubStub() {
  return http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.url === '/repos/octocat/Hello-World') {
      res.end(JSON.stringify({ full_name: 'octocat/Hello-World' }));
      return;
    }

    if (req.url === '/repos/octocat/Hello-World/releases/latest') {
      res.end(JSON.stringify({ tag_name: 'v1.0.0' }));
      return;
    }

    if (req.url === '/repos/missing/repo') {
      res.statusCode = 404;
      res.end(JSON.stringify({ message: 'Not Found' }));
      return;
    }

    if (req.url === '/repos/missing/repo/releases/latest') {
      res.statusCode = 404;
      res.end(JSON.stringify({ message: 'Not Found' }));
      return;
    }

    res.statusCode = 500;
    res.end(JSON.stringify({ message: `Unexpected GitHub stub path: ${req.url}` }));
  });
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

async function close(server) {
  if (!server?.listening) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function getStoredTokens(email) {
  const result = await query(
    `SELECT confirm_token, unsubscribe_token
     FROM subscriptions
     WHERE email = $1
     ORDER BY id DESC
     LIMIT 1`,
    [email]
  );

  return result.rows[0];
}

describe('API integration endpoints', () => {
  beforeAll(async () => {
    githubServer = createGithubStub();
    const githubPort = await listen(githubServer);
    process.env.GITHUB_API_URL = `http://127.0.0.1:${githubPort}`;

    const notificationAppModule = await import(
      '../../services/notification-service/src/app.js'
    );
    notificationServer = http.createServer(notificationAppModule.createApp());
    const notificationPort = await listen(notificationServer);
    process.env.NOTIFICATION_SERVICE_URL = `http://127.0.0.1:${notificationPort}`;

    const appModule = await import('../../src/app.js');
    const dbModule = await import('../../src/db/client.js');
    const migrationModule = await import('../../src/db/migrate.js');

    app = appModule.createApp();
    pool = dbModule.pool;
    query = dbModule.query;

    await migrationModule.runMigrations();
  });

  beforeEach(async () => {
    await query('TRUNCATE subscriptions, repositories RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await pool?.end();
    await close(githubServer);
    await close(notificationServer);
  });

  it('GET /health returns service status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('GET /health/live and /health/ready report application status', async () => {
    const live = await request(app).get('/health/live');
    const ready = await request(app).get('/health/ready');

    expect(live.status).toBe(200);
    expect(live.body).toEqual({ status: 'ok' });
    expect(ready.status).toBe(200);
    expect(ready.body).toEqual({ status: 'ready' });
  });

  it('POST /api/subscribe validates bad input', async () => {
    const response = await request(app)
      .post('/api/subscribe')
      .send({ email: 'bad', repo: 'bad' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid email' });
  });

  it('POST /api/subscribe creates a pending subscription and sends confirmation mail', async () => {
    const response = await request(app)
      .post('/api/subscribe')
      .send({ email: 'User@Example.com', repo: 'octocat/Hello-World' });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Subscription successful. Confirmation email sent.');

    const saved = await query(
      `SELECT s.email, s.confirmed, r.full_name, r.last_seen_tag
       FROM subscriptions s
       JOIN repositories r ON r.id = s.repository_id
       WHERE s.email = $1`,
      ['user@example.com']
    );

    expect(saved.rows).toHaveLength(1);
    expect(saved.rows[0]).toMatchObject({
      email: 'user@example.com',
      confirmed: false,
      full_name: 'octocat/Hello-World',
      last_seen_tag: 'v1.0.0'
    });
  });

  it('POST /api/subscribe returns 404 for unknown repositories', async () => {
    const response = await request(app)
      .post('/api/subscribe')
      .send({ email: 'user@example.com', repo: 'missing/repo' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Repository not found' });
  });

  it('GET /api/confirm/:token confirms an existing subscription', async () => {
    await request(app)
      .post('/api/subscribe')
      .send({ email: 'user@example.com', repo: 'octocat/Hello-World' });
    const { confirm_token: token } = await getStoredTokens('user@example.com');

    const response = await request(app).get(`/api/confirm/${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Subscription confirmed successfully' });

    const saved = await query('SELECT confirmed FROM subscriptions WHERE email = $1', ['user@example.com']);
    expect(saved.rows[0].confirmed).toBe(true);
  });

  it('GET /api/confirm/:token rejects invalid and unknown tokens', async () => {
    const invalid = await request(app).get('/api/confirm/short');
    const unknown = await request(app).get('/api/confirm/unknown-token-12345');

    expect(invalid.status).toBe(400);
    expect(invalid.body).toEqual({ error: 'Invalid token' });
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual({ error: 'Token not found' });
  });

  it('GET /api/subscriptions lists active subscriptions for an email', async () => {
    await request(app)
      .post('/api/subscribe')
      .send({ email: 'user@example.com', repo: 'octocat/Hello-World' });
    const { confirm_token: token } = await getStoredTokens('user@example.com');
    await request(app).get(`/api/confirm/${token}`);

    const response = await request(app)
      .get('/api/subscriptions')
      .query({ email: ' USER@example.com ' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        email: 'user@example.com',
        repo: 'octocat/Hello-World',
        confirmed: true,
        last_seen_tag: 'v1.0.0'
      }
    ]);
  });

  it('GET /api/subscriptions validates email query', async () => {
    const response = await request(app)
      .get('/api/subscriptions')
      .query({ email: 'not-email' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid email' });
  });

  it('GET /api/unsubscribe/:token unsubscribes and hides the subscription from lists', async () => {
    await request(app)
      .post('/api/subscribe')
      .send({ email: 'user@example.com', repo: 'octocat/Hello-World' });
    const {
      confirm_token: confirmToken,
      unsubscribe_token: unsubscribeToken
    } = await getStoredTokens('user@example.com');
    await request(app).get(`/api/confirm/${confirmToken}`);

    const response = await request(app).get(`/api/unsubscribe/${unsubscribeToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Unsubscribed successfully' });

    const list = await request(app)
      .get('/api/subscriptions')
      .query({ email: 'user@example.com' });
    expect(list.body).toEqual([]);
  });

  it('GET /api/unsubscribe/:token rejects invalid and unknown tokens', async () => {
    const invalid = await request(app).get('/api/unsubscribe/short');
    const unknown = await request(app).get('/api/unsubscribe/unknown-token-12345');

    expect(invalid.status).toBe(400);
    expect(invalid.body).toEqual({ error: 'Invalid token' });
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual({ error: 'Token not found' });
  });
});
