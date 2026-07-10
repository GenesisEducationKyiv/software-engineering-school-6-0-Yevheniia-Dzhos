import { isValidEmail, isValidRepo, isValidToken } from '../../../src/utils/validators.js';
import { sendSubscriptionConfirmation } from './notificationService.js';

function validateSubscriptionConfirmationRequest(body) {
  const { email, token, repo } = body || {};

  if (!isValidEmail(email)) return 'Invalid or missing field: email';
  if (!isValidToken(token)) return 'Invalid or missing field: token';
  if (!isValidRepo(repo)) return 'Invalid or missing field: repo';

  return null;
}

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
  } catch {
    sendJson(res, next, 502, { error: 'Email delivery failed' });
  }
}
