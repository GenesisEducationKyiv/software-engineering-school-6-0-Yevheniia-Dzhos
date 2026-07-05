import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scanForNewReleases } from '../../src/services/releaseScannerService.js';

function createDependencies() {
  return {
    fetchLatestReleaseTag: vi.fn(),
    sendReleaseNotification: vi.fn(),
    findRepositoriesWithActiveSubscriptions: vi.fn(),
    updateLastSeenTag: vi.fn(),
    findReleaseNotificationRecipientsByRepositoryId: vi.fn()
  };
}

describe('release scanner service', () => {
  let dependencies;

  beforeEach(() => {
    dependencies = createDependencies();
  });

  it('emails active subscribers and updates the repository tag when a new release appears', async () => {
    dependencies.findRepositoriesWithActiveSubscriptions.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0.0' }
    ]);
    dependencies.fetchLatestReleaseTag.mockResolvedValue('v1.1.0');
    dependencies.findReleaseNotificationRecipientsByRepositoryId.mockResolvedValue([
      { email: 'a@example.com', unsubscribe_token: 'unsubscribe-a' },
      { email: 'b@example.com', unsubscribe_token: 'unsubscribe-b' }
    ]);

    await scanForNewReleases(dependencies);

    expect(dependencies.sendReleaseNotification).toHaveBeenCalledTimes(2);
    expect(dependencies.sendReleaseNotification)
      .toHaveBeenCalledWith('a@example.com', 'owner/repo', 'v1.1.0', 'unsubscribe-a');
    expect(dependencies.sendReleaseNotification)
      .toHaveBeenCalledWith('b@example.com', 'owner/repo', 'v1.1.0', 'unsubscribe-b');

    expect(dependencies.updateLastSeenTag).toHaveBeenCalledWith(1, 'v1.1.0');
  });

  it('does nothing when the latest tag did not change', async () => {
    dependencies.findRepositoriesWithActiveSubscriptions.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0.0' }
    ]);
    dependencies.fetchLatestReleaseTag.mockResolvedValue('v1.0.0');

    await scanForNewReleases(dependencies);

    expect(dependencies.findReleaseNotificationRecipientsByRepositoryId).not.toHaveBeenCalled();
    expect(dependencies.sendReleaseNotification).not.toHaveBeenCalled();
    expect(dependencies.updateLastSeenTag).not.toHaveBeenCalled();
  });
});
