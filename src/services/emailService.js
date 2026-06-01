import {
  confirmationEmailTemplate,
  releaseEmailTemplate
} from '../templates/emailTemplates.js';

export async function sendConfirmationEmail(mailer, email, token, repo) {
  await mailer({
    to: email,
    subject: `Confirm subscription for ${repo}`,
    html: confirmationEmailTemplate(token, repo)
  });
}

export async function sendReleaseEmail(mailer, email, repo, tag, unsubscribeToken) {
  await mailer({
    to: email,
    subject: `New release in ${repo}: ${tag}`,
    html: releaseEmailTemplate(repo, tag, unsubscribeToken)
  });
}