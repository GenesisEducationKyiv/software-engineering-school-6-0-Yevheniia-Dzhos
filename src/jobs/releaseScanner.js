import { query } from '../db/client.js';
import { fetchLatestReleaseTag } from '../services/githubService.js';
import { sendReleaseEmail } from '../services/emailService.js';

export async function scanForNewReleases() {
  const reposResult = await query(
    `SELECT DISTINCT r.id, r.full_name, r.last_seen_tag
     FROM repositories r
     JOIN subscriptions s ON s.repository_id = r.id
     WHERE s.confirmed = TRUE AND s.unsubscribed_at IS NULL`
  );

  for (const repo of reposResult.rows) {
    try {
      const latestTag = await fetchLatestReleaseTag(repo.full_name);
      if (!latestTag || latestTag === repo.last_seen_tag) continue;

      const subscribers = await query(
        `SELECT email, unsubscribe_token
         FROM subscriptions
         WHERE repository_id = $1 AND confirmed = TRUE AND unsubscribed_at IS NULL`,
        [repo.id]
      );

      for (const subscriber of subscribers.rows) {
        await sendReleaseEmail(subscriber.email, repo.full_name, latestTag, subscriber.unsubscribe_token);
      }

      await query(
        `UPDATE repositories SET last_seen_tag = $1, updated_at = NOW() WHERE id = $2`,
        [latestTag, repo.id]
      );
    } catch (error) {
      console.error(`Scanner error for ${repo.full_name}:`, error.message);
    }
  }
}

export function startReleaseScanner(intervalMs) {
  setInterval(() => {
    scanForNewReleases().catch((error) => {
      console.error('Scheduled scanner failed:', error.message);
    });
  }, intervalMs);
}
