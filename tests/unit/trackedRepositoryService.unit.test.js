import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/releaseTracking/githubService.js', () => ({
  ensureRepositoryExists: vi.fn(),
  fetchLatestReleaseTag: vi.fn()
}));
vi.mock('../../src/modules/releaseTracking/trackedRepositoryRepository.js', () => ({
  upsertTrackedRepository: vi.fn(),
  findTrackedRepositoryByFullName: vi.fn()
}));

const githubService = await import('../../src/modules/releaseTracking/githubService.js');
const trackedRepositoryRepository = await import(
  '../../src/modules/releaseTracking/trackedRepositoryRepository.js'
);
const { trackRepository } = await import(
  '../../src/modules/releaseTracking/trackedRepositoryService.js'
);

describe('tracked repository service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates, stores and returns a tracked repository', async () => {
    githubService.fetchLatestReleaseTag.mockResolvedValue('v1.2.3');
    trackedRepositoryRepository.findTrackedRepositoryByFullName.mockResolvedValue({ id: 7 });

    await expect(trackRepository('owner/repo')).resolves.toEqual({ id: 7 });

    expect(githubService.ensureRepositoryExists).toHaveBeenCalledWith('owner/repo');
    expect(githubService.fetchLatestReleaseTag).toHaveBeenCalledWith('owner/repo');
    expect(trackedRepositoryRepository.upsertTrackedRepository)
      .toHaveBeenCalledWith('owner/repo', 'owner', 'repo', 'v1.2.3');
    expect(trackedRepositoryRepository.findTrackedRepositoryByFullName)
      .toHaveBeenCalledWith('owner/repo');
  });

  it('fails when the repository record cannot be loaded after saving', async () => {
    githubService.fetchLatestReleaseTag.mockResolvedValue(null);
    trackedRepositoryRepository.findTrackedRepositoryByFullName.mockResolvedValue(null);

    await expect(trackRepository('owner/repo')).rejects.toMatchObject({
      status: 500,
      message: 'Repository was not saved'
    });
  });
});
