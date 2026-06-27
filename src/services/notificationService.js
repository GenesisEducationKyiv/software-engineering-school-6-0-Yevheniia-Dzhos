import { sendEmail } from '../clients/emailClient.js';
import {
    sendConfirmationEmail,
    sendReleaseEmail
} from './emailService.js';

export async function sendSubscriptionConfirmation(email, token, repo, mailer = sendEmail) {
    await sendConfirmationEmail(mailer, email, token, repo);
}

export async function sendReleaseNotification(email, repo, tag, unsubscribeToken, mailer = sendEmail) {
    await sendReleaseEmail(mailer, email, repo, tag, unsubscribeToken);
}