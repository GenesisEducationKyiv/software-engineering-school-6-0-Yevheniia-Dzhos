import { AppError } from '@notifier/shared/utils/errors.js';
import { ensureRepositoryExists, fetchLatestReleaseTag } from './githubService.js';
import {
  upsertTrackedRepository,
  findTrackedRepositoryByFullName
} from './trackedRepositoryRepository.js';

export async function trackRepository(repo) {
  const trackedRepository = await findTrackedRepositoryByFullName(repo);
  await ensureRepositoryExists(repo);

  if (trackedRepository) {
    return trackedRepository;
  }

  const [owner, name] = repo.split('/');
  const latestTag = await fetchLatestReleaseTag(repo);

  const repository = await upsertTrackedRepository(repo, owner, name, latestTag);

  if (!repository) {
    throw new AppError(500, 'Repository was not saved');
  }

  return repository;
}
