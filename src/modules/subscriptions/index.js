import { findActiveSubscribersByRepositoryId } from './subscriptionRepository.js';

export { default as subscriptionRoutes } from './subscriptionRoutes.js';

export async function listActiveSubscribersForRepository(repositoryId) {
  return findActiveSubscribersByRepositoryId(repositoryId);
}
