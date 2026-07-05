import request from 'supertest';

export async function createSubscription(integration, email, repo = 'octocat/Hello-World') {
  await request(integration.app)
    .post('/api/subscribe')
    .send({ email, repo });

  return integration.getStoredTokens(email);
}
