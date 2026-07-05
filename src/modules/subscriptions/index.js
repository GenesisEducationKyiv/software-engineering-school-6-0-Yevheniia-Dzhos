import {
  deletePendingSubscription,
  findActiveSubscribersByRepositoryId
} from './subscriptionRepository.js';

export { createSubscriptionRoutes } from './subscriptionRoutes.js';

export async function listActiveSubscribersForRepository(repositoryId) {
  return findActiveSubscribersByRepositoryId(repositoryId);
}

export async function removePendingSubscription(subscriptionId) {
  return deletePendingSubscription(subscriptionId);
}
