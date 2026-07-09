import { AppError } from '@notifier/shared/utils/errors.js';
import { withTransaction } from '../../db/client.js';
import {
  normalizeSubscriptionInput,
  validateSubscriptionInput,
  normalizeEmail,
  validateEmail,
  validateToken
} from './subscriptionInputService.js';
import { createSubscriptionTokens } from './subscriptionTokenService.js';
import {
  createSubscriptionConfirmationSaga,
  dispatchSubscriptionConfirmationSaga,
  startSubscriptionConfirmationSaga
} from '../sagas/subscriptionConfirmationSaga.js';
import {
  findActiveSubscription,
  createSubscriptionRecord,
  findSubscriptionByToken,
  confirmSubscriptionRecord,
  unsubscribeSubscriptionRecord,
  listSubscriptionsByEmail
} from './subscriptionRepository.js';

function assertTrackedRepository(repository) {
  if (!repository?.id) {
    throw new AppError(500, 'Tracked repository is required');
  }
}

export async function createSubscription(input, repository) {
  const { email, repo } = normalizeSubscriptionInput(input);

  validateSubscriptionInput({ email, repo });
  assertTrackedRepository(repository);

  const existing = await findActiveSubscription(email, repository.id);

  if (existing) {
    if (!existing.confirmed) {
      return startSubscriptionConfirmationSaga({
        email,
        repo,
        confirmToken: existing.confirm_token,
        subscriptionId: existing.id
      });
    }

    throw new AppError(409, 'Email already subscribed to this repository');
  }

  const { confirmToken, unsubscribeToken } = createSubscriptionTokens();

  const saga = await withTransaction(async (client) => {
    const subscription = await createSubscriptionRecord(
      email,
      repository.id,
      confirmToken,
      unsubscribeToken,
      client
    );

    return createSubscriptionConfirmationSaga({
      email,
      repo,
      confirmToken,
      subscriptionId: subscription.id,
      shouldCompensateSubscription: true,
      client
    });
  });

  await dispatchSubscriptionConfirmationSaga(saga);

  return { sagaId: saga.id };
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
