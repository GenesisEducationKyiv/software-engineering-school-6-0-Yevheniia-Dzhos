import { env } from '../../config/env.js';
import { findRepositoriesWithActiveSubscriptions } from './trackedRepositoryRepository.js';
import { discoverNewReleases } from './releaseDiscoveryService.js';
import { handleDiscoveredRelease } from './releaseHandlerService.js';
import { processInChunks } from './processInChunks.js';
import { logger } from '@notifier/shared/modules/observability/index.js';

export async function scanForNewReleases() {
    const repositories = await findRepositoriesWithActiveSubscriptions();
    const discoveries = await discoverNewReleases(repositories, env.scanChunkSize);
    const results = await processInChunks(
        discoveries,
        env.scanChunkSize,
        (discovery) => handleDiscoveredRelease(discovery, env.scanChunkSize)
    );

    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            logger.error('Release reaction failed', {
                repository: discoveries[index]?.repository.full_name,
                error: result.reason
            });
        }
    });
}
