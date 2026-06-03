import { sendEmail } from './emailClient.js';
import {
  confirmationEmailTemplate,
  releaseEmailTemplate
} from './emailTemplates.js';

export async function sendConfirmationEmail(email, token, repo) {
  await sendEmail({
    to: email,
    subject: `Confirm subscription for ${repo}`,
    html: confirmationEmailTemplate(token, repo)
  });
}

export async function sendReleaseEmail(email, repo, tag, unsubscribeToken) {
  await sendEmail({
    to: email,
    subject: `New release in ${repo}: ${tag}`,
    html: releaseEmailTemplate(repo, tag, unsubscribeToken)
  });
}
