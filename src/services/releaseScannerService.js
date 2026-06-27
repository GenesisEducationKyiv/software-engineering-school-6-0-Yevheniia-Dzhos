import { fetchLatestReleaseTag } from './githubService.js';
import { sendReleaseNotification } from './notificationService.js';
import {
    findRepositoriesWithActiveSubscriptions,
    updateLastSeenTag
} from '../repositories/trackedRepositoryRepository.js';
import { findReleaseNotificationRecipientsByRepositoryId } from '../repositories/subscriptionRepository.js';

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

        const subscribers = await findReleaseNotificationRecipientsByRepositoryId(repository.id);

        await Promise.all(subscribers.map((subscriber) => (
            sendReleaseNotification(
                subscriber.email,
                repository.full_name,
                latestTag,
                subscriber.unsubscribe_token
            )
        )));

        await updateLastSeenTag(repository.id, latestTag);
    } catch (error) {
        console.error(`Scanner error for ${repository.full_name}:`, error.message);
    }
}