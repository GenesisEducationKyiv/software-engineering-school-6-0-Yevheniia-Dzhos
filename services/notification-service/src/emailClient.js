import nodemailer from 'nodemailer';
import { env } from './config.js';

const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined
});

export async function sendEmail({ to, subject, html }) {
    await transporter.sendMail({
        from: env.mailFrom,
        to,
        subject,
        html
    });
}
