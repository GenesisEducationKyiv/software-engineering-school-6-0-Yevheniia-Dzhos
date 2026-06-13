import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/utils/errors.js';

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
    githubService.ensureRepositoryExists.mockResolvedValue(undefined);
  });

  it('validates, stores and returns a tracked repository', async () => {
    trackedRepositoryRepository.findTrackedRepositoryByFullName.mockResolvedValue(null);
    githubService.fetchLatestReleaseTag.mockResolvedValue('v1.2.3');
    trackedRepositoryRepository.upsertTrackedRepository.mockResolvedValue({ id: 7 });

    await expect(trackRepository('owner/repo')).resolves.toEqual({ id: 7 });

    expect(trackedRepositoryRepository.findTrackedRepositoryByFullName)
      .toHaveBeenCalledWith('owner/repo');
    expect(githubService.ensureRepositoryExists).toHaveBeenCalledWith('owner/repo');
    expect(githubService.fetchLatestReleaseTag).toHaveBeenCalledWith('owner/repo');
    expect(trackedRepositoryRepository.upsertTrackedRepository)
      .toHaveBeenCalledWith('owner/repo', 'owner', 'repo', 'v1.2.3');
  });

  it('validates and returns an existing tracked repository without fetching releases', async () => {
    trackedRepositoryRepository.findTrackedRepositoryByFullName.mockResolvedValue({ id: 7 });

    await expect(trackRepository('owner/repo')).resolves.toEqual({ id: 7 });

    expect(githubService.ensureRepositoryExists).toHaveBeenCalledWith('owner/repo');
    expect(githubService.fetchLatestReleaseTag).not.toHaveBeenCalled();
    expect(trackedRepositoryRepository.upsertTrackedRepository).not.toHaveBeenCalled();
  });

  it('rejects an existing tracked repository that is no longer available', async () => {
    trackedRepositoryRepository.findTrackedRepositoryByFullName.mockResolvedValue({ id: 7 });
    githubService.ensureRepositoryExists.mockRejectedValue(new AppError(404, 'Repository not found'));

    await expect(trackRepository('owner/repo')).rejects.toMatchObject({
      status: 404,
      message: 'Repository not found'
    });

    expect(githubService.fetchLatestReleaseTag).not.toHaveBeenCalled();
    expect(trackedRepositoryRepository.upsertTrackedRepository).not.toHaveBeenCalled();
  });

  it('fails when the repository record cannot be loaded after saving', async () => {
    trackedRepositoryRepository.findTrackedRepositoryByFullName.mockResolvedValue(null);
    githubService.fetchLatestReleaseTag.mockResolvedValue(null);
    trackedRepositoryRepository.upsertTrackedRepository.mockResolvedValue(null);

    await expect(trackRepository('owner/repo')).rejects.toMatchObject({
      status: 500,
      message: 'Repository was not saved'
    });
  });
});
