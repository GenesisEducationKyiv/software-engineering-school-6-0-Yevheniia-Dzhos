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
vi.mock('../../src/db/client.js', () => ({
  withTransaction: vi.fn(async (work) => work({ query: vi.fn() }))
}));
vi.mock('@notifier/shared/modules/observability/index.js', () => ({
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
const { logger } = await import('@notifier/shared/modules/observability/index.js');
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
      .toHaveBeenCalledWith(1, 'v1.1.0', expect.anything());
    expect(trackedRepositoryRepository.updateLastSeenTag)
      .toHaveBeenCalledWith(1, 'v1.1.0', expect.anything());
  });

  it('records the discovered release and the last-seen tag in the same transaction', async () => {
    trackedRepositoryRepository.findRepositoriesWithActiveSubscriptions.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0.0' }
    ]);
    githubService.fetchLatestReleaseTag.mockResolvedValue('v1.1.0');
    subscriptionsModule.listActiveSubscribersForRepository.mockResolvedValue([
      { email: 'a@example.com', unsubscribe_token: 'unsubscribe-a' }
    ]);

    await scanForNewReleases();

    const dbClient = await import('../../src/db/client.js');
    expect(dbClient.withTransaction).toHaveBeenCalledTimes(1);
    const usedClient = trackedRepositoryRepository.recordDiscoveredRelease.mock.calls[0][2];
    expect(usedClient).toBeDefined();
    expect(trackedRepositoryRepository.updateLastSeenTag)
      .toHaveBeenCalledWith(1, 'v1.1.0', usedClient);
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

  it('keeps the release pending after a partial delivery failure so the failed subscriber is retried', async () => {
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

    expect(trackedRepositoryRepository.recordDiscoveredRelease).not.toHaveBeenCalled();
    expect(trackedRepositoryRepository.updateLastSeenTag).not.toHaveBeenCalled();
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

  it('retries a transient publish failure instead of losing the subscriber', async () => {
    trackedRepositoryRepository.findRepositoriesWithActiveSubscriptions.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0.0' }
    ]);
    githubService.fetchLatestReleaseTag.mockResolvedValue('v1.1.0');
    subscriptionsModule.listActiveSubscribersForRepository.mockResolvedValue([
      { email: 'a@example.com', unsubscribe_token: 'unsubscribe-a' }
    ]);
    notificationsModule.sendReleaseNotification
      .mockRejectedValueOnce(new Error('transient broker error'))
      .mockResolvedValueOnce(undefined);

    await scanForNewReleases();

    expect(notificationsModule.sendReleaseNotification).toHaveBeenCalledTimes(2);
    expect(trackedRepositoryRepository.recordDiscoveredRelease)
      .toHaveBeenCalledWith(1, 'v1.1.0', expect.anything());
    expect(trackedRepositoryRepository.updateLastSeenTag)
      .toHaveBeenCalledWith(1, 'v1.1.0', expect.anything());
    expect(logger.error).not.toHaveBeenCalledWith(
      'Release notification delivery failed',
      expect.anything()
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
