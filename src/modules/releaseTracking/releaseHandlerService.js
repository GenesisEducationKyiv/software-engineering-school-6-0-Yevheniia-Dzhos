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
} from '@notifier/shared/modules/observability/index.js';

const PUBLISH_RETRY_ATTEMPTS = 3;
const PUBLISH_RETRY_DELAY_MS = 200;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A failed publish never reaches the broker, so retrying carries no
// duplicate-delivery risk (unlike retrying the whole scan on the next cycle,
// which would resend to subscribers whose publish already succeeded).
async function sendWithRetry(subscriber, repository, latestTag) {
  let lastError;
  for (let attempt = 1; attempt <= PUBLISH_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await sendReleaseNotification(
        subscriber.email,
        repository.full_name,
        latestTag,
        subscriber.unsubscribe_token
      );
    } catch (error) {
      lastError = error;
      if (attempt < PUBLISH_RETRY_ATTEMPTS) await wait(PUBLISH_RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError;
}

export async function handleDiscoveredRelease(discovery, chunkSize) {
  const { repository, latestTag } = discovery;
  const subscribers = await listActiveSubscribersForRepository(repository.id);
  const deliveryResults = await processInChunks(
    subscribers,
    chunkSize,
    (subscriber) => sendWithRetry(subscriber, repository, latestTag)
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
