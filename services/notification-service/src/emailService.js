import { sendEmail } from './emailClient.js';
import {
  confirmationEmailTemplate,
  releaseEmailTemplate
} from './emailTemplates.js';

export async function sendConfirmationEmail(email, token, repo, deliveryId) {
  await sendEmail({
    to: email,
    subject: `Confirm subscription for ${repo}`,
    html: confirmationEmailTemplate(token, repo),
    messageId: deliveryId
  });
}

export async function sendReleaseEmail(email, repo, tag, unsubscribeToken, deliveryId) {
  await sendEmail({
    to: email,
    subject: `New release in ${repo}: ${tag}`,
    html: releaseEmailTemplate(repo, tag, unsubscribeToken),
    messageId: deliveryId
  });
}
