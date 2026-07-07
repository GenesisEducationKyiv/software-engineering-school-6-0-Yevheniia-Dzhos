import { sendTemplateEmail } from './emailService.js';

export async function sendNotificationEmail(to, templateId, data) {
    await sendTemplateEmail(to, templateId, data);
}
