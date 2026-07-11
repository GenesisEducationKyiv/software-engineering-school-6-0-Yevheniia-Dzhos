import { env } from './config.js';

const htmlEscapes = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => htmlEscapes[character]);
}

function encodePathSegment(value) {
  return encodeURIComponent(String(value));
}

function githubReleaseUrl(repo, tag) {
  const [owner = '', name = ''] = String(repo).split('/');

  return `https://github.com/${encodePathSegment(owner)}/${encodePathSegment(name)}/releases/tag/${encodePathSegment(tag)}`;
}

export function confirmationEmailTemplate(token, repo) {
  const confirmUrl = `${env.appBaseUrl}/api/confirm/${encodePathSegment(token)}`;

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#0b1020;color:#e5ecff;border-radius:20px;">
      <h1 style="margin:0 0 12px;font-size:24px;">Confirm subscription</h1>
      <p style="line-height:1.6;">You requested release notifications for <b>${escapeHtml(repo)}</b>.</p>
      <a href="${escapeHtml(confirmUrl)}" style="display:inline-block;margin-top:8px;padding:12px 18px;background:#6d5efc;color:#fff;text-decoration:none;border-radius:12px;">Confirm email</a>
    </div>`;
}

export function releaseEmailTemplate(repo, tag, unsubscribeToken) {
  const unsubscribeUrl = `${env.appBaseUrl}/api/unsubscribe/${encodePathSegment(unsubscribeToken)}`;
  const releaseUrl = githubReleaseUrl(repo, tag);

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#0b1020;color:#e5ecff;border-radius:20px;">
      <h1 style="margin:0 0 12px;font-size:24px;">New GitHub release</h1>
      <p style="line-height:1.6;"><b>${escapeHtml(repo)}</b> published a new release: <b>${escapeHtml(tag)}</b></p>
      <p>
        <a href="${escapeHtml(releaseUrl)}" style="display:inline-block;margin-right:12px;padding:12px 18px;background:#6d5efc;color:#fff;text-decoration:none;border-radius:12px;">Open release</a>
        <a href="${escapeHtml(unsubscribeUrl)}" style="display:inline-block;padding:12px 18px;background:#1a233d;color:#fff;text-decoration:none;border-radius:12px;">Unsubscribe</a>
      </p>
    </div>`;
}
