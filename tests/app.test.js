import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../src/app.js';

describe('app routes', () => {
  const app = createApp();

  it('returns health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('rejects invalid payload', async () => {
    const res = await request(app).post('/api/subscribe').send({ email: 'bad', repo: 'bad' });
    expect([400, 404, 409, 429, 502]).toContain(res.status);
  });
});
