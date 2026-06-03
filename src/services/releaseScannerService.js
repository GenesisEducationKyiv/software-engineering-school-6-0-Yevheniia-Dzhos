import { fetchLatestReleaseTag } from './githubService.js';
import { sendReleaseEmail } from './emailService.js';
import {
    findRepositoriesWithActiveSubscriptions,
    updateLastSeenTag
} from '../repositories/trackedRepositoryRepository.js';
import { listActiveSubscribersForRepository } from '../modules/subscriptions/index.js';
import { logger } from '../utils/logger.js';

export async function scanForNewReleases() {
    const repositories = await findRepositoriesWithActiveSubscriptions();

    for (const repository of repositories) {
        await scanRepositoryForNewRelease(repository);
    }
}

async function scanRepositoryForNewRelease(repository) {
    try {
        const latestTag = await fetchLatestReleaseTag(repository.full_name);

        if (!latestTag || latestTag === repository.last_seen_tag) {
            return;
        }

        const subscribers = await listActiveSubscribersForRepository(repository.id);

        for (const subscriber of subscribers) {
            await sendReleaseEmail(
                subscriber.email,
                repository.full_name,
                latestTag,
                subscriber.unsubscribe_token
            );
        }

        await updateLastSeenTag(repository.id, latestTag);
    } catch (error) {
        logger.error('Scanner failed for repository', {
            repository: repository.full_name,
            error
        });
    }
}