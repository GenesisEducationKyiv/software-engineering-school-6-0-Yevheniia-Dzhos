process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/releases';
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '1025';
process.env.APP_BASE_URL = 'http://localhost:3000';

import request from 'supertest';
import { describe, it, expect } from 'vitest';

const { createApp } = await import('../src/app.js');

describe('app routes', () => {
  const app = createApp();

  it('returns health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('rejects invalid payload', async () => {
    const res = await request(app).post('/api/subscribe').send({ email: 'bad', repo: 'bad' });
    expect(res.status).toBe(400);
  });
});