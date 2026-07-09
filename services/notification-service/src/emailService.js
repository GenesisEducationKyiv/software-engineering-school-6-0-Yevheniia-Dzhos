import { sendEmail } from './emailClient.js';
import { renderEmailTemplate } from './emailTemplates.js';

export async function sendTemplateEmail(to, templateId, data) {
  const { subject, html } = renderEmailTemplate(templateId, data);

  await sendEmail({
    to,
    subject,
    html
  });
}
