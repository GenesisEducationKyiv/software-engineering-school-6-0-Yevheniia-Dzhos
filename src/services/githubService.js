import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

function headers() {
  const base = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'github-release-notifier'
  };
  if (env.githubToken) base.Authorization = `Bearer ${env.githubToken}`;
  return base;
}

async function githubFetch(path) {
  const response = await fetch(`${env.githubApiUrl}${path}`, { headers: headers() });

  if (response.status === 429 || response.headers.get('x-ratelimit-remaining') === '0') {
    throw new AppError(429, 'GitHub API rate limit exceeded');
  }

  return response;
}

export async function ensureRepositoryExists(repo) {
  const response = await githubFetch(`/repos/${repo}`);
  if (response.status === 404) throw new AppError(404, 'Repository not found');
  if (!response.ok) throw new AppError(502, 'GitHub API error');
  return response.json();
}

export async function fetchLatestReleaseTag(repo) {
  const response = await githubFetch(`/repos/${repo}/releases/latest`);
  if (response.status === 404) return null;
  if (!response.ok) throw new AppError(502, 'GitHub API error');
  const data = await response.json();
  return data.tag_name || null;
}
