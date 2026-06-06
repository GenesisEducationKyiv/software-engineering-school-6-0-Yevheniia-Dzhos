import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/releaseTracking/githubService.js', () => ({
  fetchLatestReleaseTag: vi.fn()
}));
vi.mock('../../src/modules/notifications/index.js', () => ({
  sendReleaseNotification: vi.fn()
}));
vi.mock('../../src/modules/releaseTracking/trackedRepositoryRepository.js', () => ({
  findRepositoriesWithActiveSubscriptions: vi.fn(),
  recordDiscoveredRelease: vi.fn(),
  updateLastSeenTag: vi.fn()
}));
vi.mock('../../src/modules/subscriptions/index.js', () => ({
  listActiveSubscribersForRepository: vi.fn()
}));

const githubService = await import('../../src/modules/releaseTracking/githubService.js');
const notificationsModule = await import('../../src/modules/notifications/index.js');
const trackedRepositoryRepository = await import(
  '../../src/modules/releaseTracking/trackedRepositoryRepository.js'
);
const subscriptionsModule = await import('../../src/modules/subscriptions/index.js');
const { scanForNewReleases } = await import(
  '../../src/modules/releaseTracking/releaseScannerService.js'
);

describe('release scanner service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emails active subscribers and updates the repository tag when a new release appears', async () => {
    trackedRepositoryRepository.findRepositoriesWithActiveSubscriptions.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0.0' }
    ]);
    githubService.fetchLatestReleaseTag.mockResolvedValue('v1.1.0');
    subscriptionsModule.listActiveSubscribersForRepository.mockResolvedValue([
      { email: 'a@example.com', unsubscribe_token: 'unsubscribe-a' },
      { email: 'b@example.com', unsubscribe_token: 'unsubscribe-b' }
    ]);

    await scanForNewReleases();

    expect(notificationsModule.sendReleaseNotification).toHaveBeenCalledTimes(2);
    expect(notificationsModule.sendReleaseNotification)
      .toHaveBeenCalledWith('a@example.com', 'owner/repo', 'v1.1.0', 'unsubscribe-a');
    expect(notificationsModule.sendReleaseNotification)
      .toHaveBeenCalledWith('b@example.com', 'owner/repo', 'v1.1.0', 'unsubscribe-b');

    expect(trackedRepositoryRepository.recordDiscoveredRelease)
      .toHaveBeenCalledWith(1, 'v1.1.0');
    expect(trackedRepositoryRepository.updateLastSeenTag).toHaveBeenCalledWith(1, 'v1.1.0');
  });

  it('does nothing when the latest tag did not change', async () => {
    trackedRepositoryRepository.findRepositoriesWithActiveSubscriptions.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0.0' }
    ]);
    githubService.fetchLatestReleaseTag.mockResolvedValue('v1.0.0');

    await scanForNewReleases();

    expect(subscriptionsModule.listActiveSubscribersForRepository).not.toHaveBeenCalled();
    expect(notificationsModule.sendReleaseNotification).not.toHaveBeenCalled();
    expect(trackedRepositoryRepository.recordDiscoveredRelease).not.toHaveBeenCalled();
    expect(trackedRepositoryRepository.updateLastSeenTag).not.toHaveBeenCalled();
  });
});
