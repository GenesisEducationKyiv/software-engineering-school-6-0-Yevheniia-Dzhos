import { fetchLatestReleaseTag } from './githubService.js';
import { sendReleaseNotification } from './notificationService.js';
import {
    findRepositoriesWithActiveSubscriptions,
    updateLastSeenTag
} from '../repositories/trackedRepositoryRepository.js';
import { findReleaseNotificationRecipientsByRepositoryId } from '../repositories/subscriptionRepository.js';
import { logger } from '../utils/logger.js';

const defaultReleaseScannerDependencies = {
    fetchLatestReleaseTag,
    sendReleaseNotification,
    findRepositoriesWithActiveSubscriptions,
    updateLastSeenTag,
    findReleaseNotificationRecipientsByRepositoryId
};

export async function scanForNewReleases(dependencies = defaultReleaseScannerDependencies) {
    const repositories = await dependencies.findRepositoriesWithActiveSubscriptions();

    for (const repository of repositories) {
        await scanRepositoryForNewRelease(repository, dependencies);
    }
}

async function scanRepositoryForNewRelease(repository, dependencies) {
    try {
        const latestTag = await dependencies.fetchLatestReleaseTag(repository.full_name);

        if (!latestTag || latestTag === repository.last_seen_tag) {
            return;
        }

        const subscribers = await dependencies.findReleaseNotificationRecipientsByRepositoryId(repository.id);

        await Promise.all(subscribers.map((subscriber) => (
            dependencies.sendReleaseNotification(
                subscriber.email,
                repository.full_name,
                latestTag,
                subscriber.unsubscribe_token
            )
        )));

        await dependencies.updateLastSeenTag(repository.id, latestTag);
    } catch (error) {
        logger.error('Scanner failed for repository', {
            repository: repository.full_name,
            error
        });
    }
}
