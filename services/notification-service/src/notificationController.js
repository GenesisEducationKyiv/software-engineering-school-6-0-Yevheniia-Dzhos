import { validateSubscriptionConfirmationRequest } from '@notifier/shared/utils/validators.js';
import { sendSubscriptionConfirmation } from './notificationService.js';
import { logger } from './observability.js';

function sendJson(res, next, status, body) {
  try {
    res.status(status).json(body);
  } catch (error) {
    next(error);
  }
}

export async function sendSubscriptionConfirmationRest(req, res, next) {
  const validationError = validateSubscriptionConfirmationRequest(req.body);

  if (validationError) {
    sendJson(res, next, 400, { error: validationError });
    return;
  }

  const { email, token, repo } = req.body;

  try {
    await sendSubscriptionConfirmation(email.trim().toLowerCase(), token, repo.trim());
    sendJson(res, next, 200, { status: 'sent' });
  } catch (error) {
    logger.error('Notification REST email delivery failed', { error });
    sendJson(res, next, 502, { error: 'Email delivery failed' });
  }
}
