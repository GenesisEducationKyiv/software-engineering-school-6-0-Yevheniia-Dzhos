import nodemailer from 'nodemailer';
import { env } from './config.js';

const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined
});

function formatMessageId(messageId) {
    if (!messageId) return undefined;

    const safeId = String(messageId).replace(/[^a-zA-Z0-9._-]/g, '-');
    return `<${safeId}@github-release-notifier.local>`;
}

export async function sendEmail({ to, subject, html, messageId }) {
    await transporter.sendMail({
        from: env.mailFrom,
        to,
        subject,
        html,
        messageId: formatMessageId(messageId)
    });
}

export async function verifyEmailConnection() {
    await transporter.verify();
}
