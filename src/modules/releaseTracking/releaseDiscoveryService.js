import { fetchLatestReleaseTag } from './githubService.js';
import { processInChunks } from './processInChunks.js';
import { logger } from '@notifier/shared/modules/observability/index.js';

export async function discoverNewReleases(repositories, chunkSize) {
  const results = await processInChunks(repositories, chunkSize, async (repository) => {
    const latestTag = await fetchLatestReleaseTag(repository.full_name);

    if (!latestTag || latestTag === repository.last_seen_tag) {
      return null;
    }

    return { repository, latestTag };
  });

  return results.flatMap((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value ? [result.value] : [];
    }

    logger.error('Release discovery failed for repository', {
      repository: repositories[index]?.full_name,
      error: result.reason
    });
    return [];
  });
}
