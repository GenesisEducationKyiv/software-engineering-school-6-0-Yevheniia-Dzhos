import { AppError } from '../utils/errors.js';
import { ensureRepositoryExists, fetchLatestReleaseTag } from './githubService.js';
import {
  normalizeSubscriptionInput,
  validateSubscriptionInput,
  normalizeEmail,
  validateEmail,
  validateToken
} from './subscriptionInputService.js';
import { createSubscriptionTokens } from './subscriptionTokenService.js';
import { sendSubscriptionConfirmation } from './notificationService.js';
import {
  upsertTrackedRepository,
  findTrackedRepositoryByFullName
} from '../repositories/trackedRepositoryRepository.js';
import {
  findActiveSubscription,
  findUnsubscribedSubscription,
  createSubscriptionRecord,
  reactivateSubscriptionRecord,
  findSubscriptionByToken,
  confirmSubscriptionRecord,
  unsubscribeSubscriptionRecord,
  listSubscriptionsByEmail
} from '../repositories/subscriptionRepository.js';

export async function createSubscription(input) {
  const { email, repo } = normalizeSubscriptionInput(input);

  validateSubscriptionInput({ email, repo });

  await ensureRepositoryExists(repo);

  const [owner, name] = repo.split('/');
  const latestTag = await fetchLatestReleaseTag(repo);

  await upsertTrackedRepository(repo, owner, name, latestTag);

  const repository = await findTrackedRepositoryByFullName(repo);

  if (!repository) {
    throw new AppError(500, 'Repository was not saved');
  }

  const existing = await findActiveSubscription(email, repository.id);

  if (existing) {
    throw new AppError(409, 'Email already subscribed to this repository');
  }

  const { confirmToken, unsubscribeToken } = createSubscriptionTokens();

  const unsubscribed = await findUnsubscribedSubscription(email, repository.id);

  if (unsubscribed) {
    await reactivateSubscriptionRecord(
      unsubscribed.id,
      confirmToken,
      unsubscribeToken
    );

    await sendSubscriptionConfirmation(email, confirmToken, repo);
    return;
  }

  await createSubscriptionRecord(
    email,
    repository.id,
    confirmToken,
    unsubscribeToken
  );

  await sendSubscriptionConfirmation(email, confirmToken, repo);
}

export async function confirmSubscription(token) {
  validateToken(token);

  const subscription = await findSubscriptionByToken('confirm_token', token);

  if (!subscription) {
    throw new AppError(404, 'Token not found');
  }

  await confirmSubscriptionRecord(subscription.id);
}

export async function unsubscribe(token) {
  validateToken(token);

  const subscription = await findSubscriptionByToken('unsubscribe_token', token);

  if (!subscription) {
    throw new AppError(404, 'Token not found');
  }

  await unsubscribeSubscriptionRecord(subscription.id);
}

export async function listSubscriptions(email) {
  const normalizedEmail = normalizeEmail(email);

  validateEmail(normalizedEmail);

  const rows = await listSubscriptionsByEmail(normalizedEmail);

  return rows.map((row) => ({
    email: row.email,
    repo: row.repo,
    confirmed: row.confirmed,
    last_seen_tag: row.last_seen_tag
  }));
}