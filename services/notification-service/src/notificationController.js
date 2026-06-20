import { isValidEmail, isValidRepo, isValidToken } from '../../../src/utils/validators.js';
import { sendSubscriptionConfirmation } from './notificationService.js';

function validateSubscriptionConfirmationRequest(body) {
  const { email, token, repo } = body || {};

  if (!isValidEmail(email)) return 'Invalid or missing field: email';
  if (!isValidToken(token)) return 'Invalid or missing field: token';
  if (!isValidRepo(repo)) return 'Invalid or missing field: repo';

  return null;
}

export async function sendSubscriptionConfirmationRest(req, res) {
  const validationError = validateSubscriptionConfirmationRequest(req.body);

  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const { email, token, repo } = req.body;

  try {
    await sendSubscriptionConfirmation(email.trim().toLowerCase(), token, repo.trim());
    res.status(200).json({ status: 'sent' });
  } catch {
    res.status(502).json({ error: 'Email delivery failed' });
  }
}
