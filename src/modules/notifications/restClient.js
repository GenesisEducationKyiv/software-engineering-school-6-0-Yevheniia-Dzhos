import { AppError } from '../../utils/errors.js';

export function createNotificationRestClient({ baseUrl, fetchImpl = fetch }) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

  async function sendSubscriptionConfirmation(email, token, repo) {
    const response = await fetchImpl(
      `${normalizedBaseUrl}/api/notifications/subscription-confirmation`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, repo })
      }
    );

    if (response.ok) return response.json();

    let errorBody = {};
    try {
      errorBody = await response.json();
    } catch {
      errorBody = {};
    }

    throw new AppError(
      response.status === 400 ? 400 : 502,
      errorBody.error || 'Notification service unavailable'
    );
  }

  return { sendSubscriptionConfirmation };
}
