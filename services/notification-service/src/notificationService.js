import { sendConfirmationEmail, sendReleaseEmail } from './emailService.js';

export async function sendSubscriptionConfirmation(email, token, repo, deliveryId) {
    await sendConfirmationEmail(email, token, repo, deliveryId);
}

export async function sendReleaseNotification(email, repo, tag, unsubscribeToken, deliveryId) {
    await sendReleaseEmail(email, repo, tag, unsubscribeToken, deliveryId);
}
