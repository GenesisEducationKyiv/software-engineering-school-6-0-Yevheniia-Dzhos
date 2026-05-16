import { sendConfirmationEmail } from './emailService.js';

export async function sendSubscriptionConfirmation(email, token, repo) {
    await sendConfirmationEmail(email, token, repo);
}