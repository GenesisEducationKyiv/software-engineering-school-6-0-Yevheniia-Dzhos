import { fetchLatestReleaseTag } from './githubService.js';
import { sendReleaseNotification } from './notificationService.js';
import {
    findRepositoriesWithActiveSubscriptions,
    updateLastSeenTag
} from '../repositories/trackedRepositoryRepository.js';
import { findReleaseNotificationRecipientsByRepositoryId } from '../repositories/subscriptionRepository.js';
import { logger } from '../utils/logger.js';
import {
    recordReleaseNotificationsSent,
    recordReleaseScannerRepositoryFailure,
    recordReleaseScannerRun
} from '../utils/metrics.js';

const defaultReleaseScannerDependencies = {
    fetchLatestReleaseTag,
    sendReleaseNotification,
    findRepositoriesWithActiveSubscriptions,
    updateLastSeenTag,
    findReleaseNotificationRecipientsByRepositoryId
};

export async function scanForNewReleases(dependencies = defaultReleaseScannerDependencies) {
    const startedAt = process.hrtime.bigint();
    let status = 'success';

    try {
        const repositories = await dependencies.findRepositoriesWithActiveSubscriptions();

        for (const repository of repositories) {
            await scanRepositoryForNewRelease(repository, dependencies);
        }
    } catch (error) {
        status = 'error';
        throw error;
    } finally {
        const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
        recordReleaseScannerRun(status, durationSeconds);
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

        recordReleaseNotificationsSent(subscribers.length);
        await dependencies.updateLastSeenTag(repository.id, latestTag);
    } catch (error) {
        recordReleaseScannerRepositoryFailure(repository.full_name);
        logger.error('Scanner failed for repository', {
            repository: repository.full_name,
            error
        });
    }
}
