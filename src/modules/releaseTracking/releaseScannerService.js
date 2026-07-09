import { env } from '../../config/env.js';
import { findRepositoriesWithActiveSubscriptions } from './trackedRepositoryRepository.js';
import { discoverNewReleases } from './releaseDiscoveryService.js';
import { handleDiscoveredRelease } from './releaseHandlerService.js';
import { processInChunks } from './processInChunks.js';
import {
    logger,
    recordReleaseScannerRepositoryFailure,
    recordReleaseScannerRun
} from '@notifier/shared/modules/observability/index.js';

export async function scanForNewReleases() {
    const startedAt = process.hrtime.bigint();
    let status = 'success';

    try {
        const repositories = await findRepositoriesWithActiveSubscriptions();
        const discoveries = await discoverNewReleases(repositories, env.scanChunkSize);
        const results = await processInChunks(
            discoveries,
            env.scanChunkSize,
            (discovery) => handleDiscoveredRelease(discovery, env.scanChunkSize)
        );

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const repository = discoveries[index]?.repository.full_name;

                if (repository) {
                    recordReleaseScannerRepositoryFailure(repository);
                }

                logger.error('Release reaction failed', {
                    repository,
                    error: result.reason
                });
            }
        });
    } catch (error) {
        status = 'error';
        throw error;
    } finally {
        const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
        recordReleaseScannerRun(status, durationSeconds);
    }
}
