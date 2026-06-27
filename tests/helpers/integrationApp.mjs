import { afterAll, afterEach, beforeAll } from 'vitest';
import { applyTestEnv } from './testEnv.mjs';

applyTestEnv();

export function setupIntegrationApp() {
  const createdEmails = new Set();
  const context = {
    app: null,
    pool: null,
    query: null
  };

  beforeAll(async () => {
    const appModule = await import('../../src/app.js');
    const dbModule = await import('../../src/db/client.js');

    context.app = appModule.createApp();
    context.pool = dbModule.pool;
    context.query = dbModule.query;
  });

  afterEach(async () => {
    if (createdEmails.size === 0) return;

    await context.query(
      'DELETE FROM subscriptions WHERE email = ANY($1::text[])',
      [[...createdEmails]]
    );
    createdEmails.clear();
  });

  afterAll(async () => {
    await context.pool?.end();
  });

  return {
    get app() {
      return context.app;
    },
    get query() {
      return context.query;
    },
    uniqueEmail(prefix = 'user') {
      const email = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
      createdEmails.add(email);
      return email;
    },
    async getStoredTokens(email) {
      const result = await context.query(
        `SELECT confirm_token, unsubscribe_token
         FROM subscriptions
         WHERE email = $1
         ORDER BY id DESC
         LIMIT 1`,
        [email]
      );

      return result.rows[0];
    }
  };
}
