import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../src/utils/errors.js';

vi.mock('../src/db/client.js', () => ({ query: vi.fn() }));
vi.mock('../src/services/githubService.js', () => ({
  ensureRepositoryExists: vi.fn(),
  fetchLatestReleaseTag: vi.fn()
}));
vi.mock('../src/services/notificationService.js', () => ({ sendSubscriptionConfirmation: vi.fn() }));
vi.mock('../src/utils/tokens.js', () => ({ generateToken: vi.fn() }));

const { query } = await import('../src/db/client.js');
const githubService = await import('../src/services/githubService.js');
const notificationService = await import('../src/services/notificationService.js');
const tokens = await import('../src/utils/tokens.js');
const subscriptionService = await import('../src/services/subscriptionService.js');

describe('subscriptionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid repo format', async () => {
    await expect(subscriptionService.createSubscription({ email: 'a@b.com', repo: 'bad' }))
      .rejects.toBeInstanceOf(AppError);
  });

  it('creates a subscription and sends confirmation email', async () => {
    githubService.fetchLatestReleaseTag.mockResolvedValue('v1.0.0');
    tokens.generateToken.mockReturnValueOnce('confirm-token-12345').mockReturnValueOnce('unsubscribe-token-12345');
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await subscriptionService.createSubscription({ email: 'User@Test.com', repo: 'golang/go' });

    expect(githubService.ensureRepositoryExists).toHaveBeenCalledWith('golang/go');
    expect(notificationService.sendSubscriptionConfirmation).toHaveBeenCalledWith('user@test.com', 'confirm-token-12345', 'golang/go');
  });

  it('reactivates an unsubscribed subscription and sends a new confirmation email', async () => {
    githubService.fetchLatestReleaseTag.mockResolvedValue('v1.0.0');
    tokens.generateToken.mockReturnValueOnce('new-confirm-token').mockReturnValueOnce('new-unsubscribe-token');
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 7 }] })
      .mockResolvedValueOnce({ rows: [] });

    await subscriptionService.createSubscription({ email: 'User@Test.com', repo: 'golang/go' });

    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE subscriptions'),
      ['new-confirm-token', 'new-unsubscribe-token', 7]
    );
    expect(notificationService.sendSubscriptionConfirmation).toHaveBeenCalledWith('user@test.com', 'new-confirm-token', 'golang/go');
  });

  it('lists subscriptions', async () => {
    query.mockResolvedValueOnce({
      rows: [{ email: 'user@test.com', repo: 'golang/go', confirmed: true, last_seen_tag: 'v1.0.0' }]
    });

    const result = await subscriptionService.listSubscriptions('user@test.com');
    expect(result).toEqual([
      { email: 'user@test.com', repo: 'golang/go', confirmed: true, last_seen_tag: 'v1.0.0' }
    ]);
  });
});
