import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';

async function sendNotification(path, payload) {
  let response;

  try {
    response = await fetch(`${env.notificationServiceUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch {
    throw new AppError(502, 'Notification service unavailable');
  }

  if (!response.ok) {
    throw new AppError(502, 'Notification service error');
  }
}

export async function sendSubscriptionConfirmation(email, token, repo) {
  await sendNotification('/notifications/subscription-confirmation', {
    email,
    token,
    repo
  });
}

export async function sendReleaseNotification(email, repo, tag, unsubscribeToken) {
  await sendNotification('/notifications/release', {
    email,
    repo,
    tag,
    unsubscribeToken
  });
}
