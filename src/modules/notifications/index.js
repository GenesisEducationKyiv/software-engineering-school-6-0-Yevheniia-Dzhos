import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';

async function sendNotification(path, payload) {
  let response;

  try {
    const url = new URL(path, `${env.notificationServiceUrl.replace(/\/+$/, '')}/`);
    response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(env.notificationRequestTimeoutMs)
    });
  } catch {
    throw new AppError(502, 'Notification service unavailable');
  }

  if (!response.ok) {
    throw new AppError(502, 'Notification service error');
  }
}

export async function sendSubscriptionConfirmation(email, token, repo) {
  await sendNotification('/notifications/email', {
    to: email,
    templateId: 'subscription-confirmation',
    data: {
      token,
      repo
    }
  });
}

export async function sendReleaseNotification(email, repo, tag, unsubscribeToken) {
  await sendNotification('/notifications/email', {
    to: email,
    templateId: 'release-notification',
    data: {
      repo,
      tag,
      unsubscribeToken
    }
  });
}
