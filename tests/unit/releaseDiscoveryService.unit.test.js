import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/releaseTracking/githubService.js', () => ({
  fetchLatestReleaseTag: vi.fn()
}));
vi.mock('@notifier/shared/modules/observability/index.js', () => ({
  logger: { error: vi.fn() }
}));

const githubService = await import('../../src/modules/releaseTracking/githubService.js');
const { logger } = await import('@notifier/shared/modules/observability/index.js');
const { discoverNewReleases } = await import(
  '../../src/modules/releaseTracking/releaseDiscoveryService.js'
);

describe('release discovery service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports a discovery when the latest tag changed', async () => {
    githubService.fetchLatestReleaseTag.mockResolvedValue('v1.1.0');

    const discoveries = await discoverNewReleases(
      [{ id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0.0' }],
      5
    );

    expect(discoveries).toEqual([{
      repository: { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0.0' },
      latestTag: 'v1.1.0'
    }]);
  });

  it('skips a repository whose latest tag has not changed', async () => {
    githubService.fetchLatestReleaseTag.mockResolvedValue('v1.0.0');

    const discoveries = await discoverNewReleases(
      [{ id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0.0' }],
      5
    );

    expect(discoveries).toEqual([]);
  });

  it('isolates a per-repository lookup failure so other repositories are still discovered', async () => {
    const lookupError = new Error('GitHub rate limit exceeded');
    githubService.fetchLatestReleaseTag.mockImplementation(async (fullName) => {
      if (fullName === 'owner/broken-repo') throw lookupError;
      return 'v2.0.0';
    });

    const discoveries = await discoverNewReleases(
      [
        { id: 1, full_name: 'owner/broken-repo', last_seen_tag: 'v1.0.0' },
        { id: 2, full_name: 'owner/healthy-repo', last_seen_tag: 'v1.0.0' }
      ],
      5
    );

    expect(discoveries).toEqual([{
      repository: { id: 2, full_name: 'owner/healthy-repo', last_seen_tag: 'v1.0.0' },
      latestTag: 'v2.0.0'
    }]);
    expect(logger.error).toHaveBeenCalledWith('Release discovery failed for repository', {
      repository: 'owner/broken-repo',
      error: lookupError
    });
  });
});
