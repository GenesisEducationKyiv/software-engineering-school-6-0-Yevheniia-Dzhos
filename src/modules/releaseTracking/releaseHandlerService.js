import { sendReleaseNotification } from '../notifications/index.js';
import { listActiveSubscribersForRepository } from '../subscriptions/index.js';
import {
  recordDiscoveredRelease,
  updateLastSeenTag
} from './trackedRepositoryRepository.js';
import { processInChunks } from './processInChunks.js';
import {
  logger,
  recordReleaseNotificationsSent
} from '../observability/index.js';

export async function handleDiscoveredRelease(discovery, chunkSize) {
  const { repository, latestTag } = discovery;
  const subscribers = await listActiveSubscribersForRepository(repository.id);
  const deliveryResults = await processInChunks(
    subscribers,
    chunkSize,
    (subscriber) => sendReleaseNotification(
      subscriber.email,
      repository.full_name,
      latestTag,
      subscriber.unsubscribe_token
    )
  );
  const failedDeliveries = deliveryResults
    .map((result, index) => ({ result, subscriber: subscribers[index] }))
    .filter(({ result }) => result.status === 'rejected');
  const sentCount = deliveryResults.filter((result) => result.status === 'fulfilled').length;

  failedDeliveries.forEach(({ result, subscriber }) => {
    logger.error('Release notification delivery failed', {
      repository: repository.full_name,
      tag: latestTag,
      email: subscriber.email,
      error: result.reason
    });
  });

  if (subscribers.length > 0 && failedDeliveries.length === subscribers.length) {
    throw failedDeliveries[0].result.reason;
  }

  recordReleaseNotificationsSent(sentCount);
  await recordDiscoveredRelease(repository.id, latestTag);
  await updateLastSeenTag(repository.id, latestTag);
}
