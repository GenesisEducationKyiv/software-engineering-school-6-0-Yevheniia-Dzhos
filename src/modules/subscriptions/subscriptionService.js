import { AppError } from '../../utils/errors.js';
import { trackRepository } from '../releaseTracking/index.js';
import {
  normalizeSubscriptionInput,
  validateSubscriptionInput,
  normalizeEmail,
  validateEmail,
  validateToken
} from './subscriptionInputService.js';
import { createSubscriptionTokens } from './subscriptionTokenService.js';
import { startSubscriptionConfirmationSaga } from '../sagas/subscriptionConfirmationSaga.js';
import {
  findActiveSubscription,
  createSubscriptionRecord,
  findSubscriptionByToken,
  confirmSubscriptionRecord,
  unsubscribeSubscriptionRecord,
  listSubscriptionsByEmail
} from './subscriptionRepository.js';

export async function createSubscription(input) {
  const { email, repo } = normalizeSubscriptionInput(input);

  validateSubscriptionInput({ email, repo });

  const repository = await trackRepository(repo);

  const existing = await findActiveSubscription(email, repository.id);

  if (existing) {
    if (!existing.confirmed) {
      await startSubscriptionConfirmationSaga({
        email,
        repo,
        confirmToken: existing.confirm_token,
        subscriptionId: existing.id
      });
      return;
    }

    throw new AppError(409, 'Email already subscribed to this repository');
  }

  const { confirmToken, unsubscribeToken } = createSubscriptionTokens();

  const subscription = await createSubscriptionRecord(
    email,
    repository.id,
    confirmToken,
    unsubscribeToken
  );

  await startSubscriptionConfirmationSaga({
    email,
    repo,
    confirmToken,
    subscriptionId: subscription.id,
    shouldCompensateSubscription: true
  });
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
