import { findActiveSubscribersByRepositoryId } from './subscriptionRepository.js';

export { createSubscriptionRoutes } from './subscriptionRoutes.js';

export async function listActiveSubscribersForRepository(repositoryId) {
  return findActiveSubscribersByRepositoryId(repositoryId);
}
