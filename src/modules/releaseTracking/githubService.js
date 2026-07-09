import { AppError } from '@notifier/shared/utils/errors.js';
import { githubGet } from './githubClient.js';

export async function ensureRepositoryExists(repo) {
  const response = await githubGet(`/repos/${repo}`);

  if (response.status === 404) {
    throw new AppError(404, 'Repository not found');
  }

  if (!response.ok) {
    throw new AppError(502, 'GitHub API error');
  }

  return response.json();
}

export async function fetchLatestReleaseTag(repo) {
  const response = await githubGet(`/repos/${repo}/releases/latest`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new AppError(502, 'GitHub API error');
  }

  const data = await response.json();

  return data.tag_name || null;
}
