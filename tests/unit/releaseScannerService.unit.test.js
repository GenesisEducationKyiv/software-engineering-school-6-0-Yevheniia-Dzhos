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
vi.mock('../../src/modules/observability/index.js', () => ({
  logger: {
    error: vi.fn()
  },
  recordReleaseNotificationsSent: vi.fn(),
  recordReleaseScannerRepositoryFailure: vi.fn(),
  recordReleaseScannerRun: vi.fn()
}));

const githubService = await import('../../src/modules/releaseTracking/githubService.js');
const notificationsModule = await import('../../src/modules/notifications/index.js');
const trackedRepositoryRepository = await import(
  '../../src/modules/releaseTracking/trackedRepositoryRepository.js'
);
const subscriptionsModule = await import('../../src/modules/subscriptions/index.js');
const { logger } = await import('../../src/modules/observability/index.js');
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

  it('marks the release as handled after a partial delivery failure', async () => {
    trackedRepositoryRepository.findRepositoriesWithActiveSubscriptions.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0.0' }
    ]);
    githubService.fetchLatestReleaseTag.mockResolvedValue('v1.1.0');
    subscriptionsModule.listActiveSubscribersForRepository.mockResolvedValue([
      { email: 'a@example.com', unsubscribe_token: 'unsubscribe-a' },
      { email: 'b@example.com', unsubscribe_token: 'unsubscribe-b' }
    ]);
    notificationsModule.sendReleaseNotification.mockImplementation(async (email) => {
      if (email === 'b@example.com') throw new Error('delivery failed');
    });

    await scanForNewReleases();

    expect(trackedRepositoryRepository.recordDiscoveredRelease)
      .toHaveBeenCalledWith(1, 'v1.1.0');
    expect(trackedRepositoryRepository.updateLastSeenTag).toHaveBeenCalledWith(1, 'v1.1.0');
    expect(logger.error).toHaveBeenCalledWith(
      'Release notification delivery failed',
      expect.objectContaining({
        repository: 'owner/repo',
        tag: 'v1.1.0',
        email: 'b@example.com',
        error: expect.any(Error)
      })
    );
  });

  it('keeps the release pending when every delivery fails', async () => {
    trackedRepositoryRepository.findRepositoriesWithActiveSubscriptions.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0.0' }
    ]);
    githubService.fetchLatestReleaseTag.mockResolvedValue('v1.1.0');
    subscriptionsModule.listActiveSubscribersForRepository.mockResolvedValue([
      { email: 'a@example.com', unsubscribe_token: 'unsubscribe-a' },
      { email: 'b@example.com', unsubscribe_token: 'unsubscribe-b' }
    ]);
    notificationsModule.sendReleaseNotification.mockRejectedValue(new Error('delivery failed'));

    await scanForNewReleases();

    expect(trackedRepositoryRepository.recordDiscoveredRelease).not.toHaveBeenCalled();
    expect(trackedRepositoryRepository.updateLastSeenTag).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'Release reaction failed',
      expect.objectContaining({
        repository: 'owner/repo',
        error: expect.any(Error)
      })
    );
  });
});
