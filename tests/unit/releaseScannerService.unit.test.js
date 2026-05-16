import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/githubService.js', () => ({
  fetchLatestReleaseTag: vi.fn()
}));
vi.mock('../../src/services/emailService.js', () => ({
  sendReleaseEmail: vi.fn()
}));
vi.mock('../../src/repositories/trackedRepositoryRepository.js', () => ({
  findRepositoriesWithActiveSubscriptions: vi.fn(),
  updateLastSeenTag: vi.fn()
}));
vi.mock('../../src/repositories/subscriptionRepository.js', () => ({
  findActiveSubscribersByRepositoryId: vi.fn()
}));

const githubService = await import('../../src/services/githubService.js');
const emailService = await import('../../src/services/emailService.js');
const trackedRepositoryRepository = await import('../../src/repositories/trackedRepositoryRepository.js');
const subscriptionRepository = await import('../../src/repositories/subscriptionRepository.js');
const { scanForNewReleases } = await import('../../src/services/releaseScannerService.js');

describe('release scanner service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emails active subscribers and updates the repository tag when a new release appears', async () => {
    trackedRepositoryRepository.findRepositoriesWithActiveSubscriptions.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0.0' }
    ]);
    githubService.fetchLatestReleaseTag.mockResolvedValue('v1.1.0');
    subscriptionRepository.findActiveSubscribersByRepositoryId.mockResolvedValue([
      { email: 'a@example.com', unsubscribe_token: 'unsubscribe-a' },
      { email: 'b@example.com', unsubscribe_token: 'unsubscribe-b' }
    ]);

    await scanForNewReleases();

    expect(emailService.sendReleaseEmail).toHaveBeenCalledTimes(2);
    expect(emailService.sendReleaseEmail)
      .toHaveBeenCalledWith('a@example.com', 'owner/repo', 'v1.1.0', 'unsubscribe-a');
    expect(emailService.sendReleaseEmail)
      .toHaveBeenCalledWith('b@example.com', 'owner/repo', 'v1.1.0', 'unsubscribe-b');

    expect(trackedRepositoryRepository.updateLastSeenTag).toHaveBeenCalledWith(1, 'v1.1.0');
  });

  it('does nothing when the latest tag did not change', async () => {
    trackedRepositoryRepository.findRepositoriesWithActiveSubscriptions.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0.0' }
    ]);
    githubService.fetchLatestReleaseTag.mockResolvedValue('v1.0.0');

    await scanForNewReleases();

    expect(subscriptionRepository.findActiveSubscribersByRepositoryId).not.toHaveBeenCalled();
    expect(emailService.sendReleaseEmail).not.toHaveBeenCalled();
    expect(trackedRepositoryRepository.updateLastSeenTag).not.toHaveBeenCalled();
  });
});
