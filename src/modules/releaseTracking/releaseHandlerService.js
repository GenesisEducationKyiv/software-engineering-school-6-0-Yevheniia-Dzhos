import { sendReleaseNotification } from '../notifications/index.js';
import { listActiveSubscribersForRepository } from '../subscriptions/index.js';
import {
  recordDiscoveredRelease,
  updateLastSeenTag
} from './trackedRepositoryRepository.js';
import { processInChunks } from './processInChunks.js';

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
  const failedDelivery = deliveryResults.find((result) => result.status === 'rejected');

  if (failedDelivery) {
    throw failedDelivery.reason;
  }

  await recordDiscoveredRelease(repository.id, latestTag);
  await updateLastSeenTag(repository.id, latestTag);
}
