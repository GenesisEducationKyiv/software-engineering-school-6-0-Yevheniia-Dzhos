import { sendConfirmationEmail, sendReleaseEmail } from './emailService.js';

export async function sendSubscriptionConfirmation(email, token, repo) {
    await sendConfirmationEmail(email, token, repo);
}

export async function sendReleaseNotification(email, repo, tag, unsubscribeToken) {
    await sendReleaseEmail(email, repo, tag, unsubscribeToken);
}
