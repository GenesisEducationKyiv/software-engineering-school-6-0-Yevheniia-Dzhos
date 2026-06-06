import { AppError } from '../../utils/errors.js';
import { ensureRepositoryExists, fetchLatestReleaseTag } from './githubService.js';
import {
  upsertTrackedRepository,
  findTrackedRepositoryByFullName
} from './trackedRepositoryRepository.js';

export async function trackRepository(repo) {
  await ensureRepositoryExists(repo);

  const [owner, name] = repo.split('/');
  const latestTag = await fetchLatestReleaseTag(repo);

  await upsertTrackedRepository(repo, owner, name, latestTag);

  const repository = await findTrackedRepositoryByFullName(repo);

  if (!repository) {
    throw new AppError(500, 'Repository was not saved');
  }

  return repository;
}
