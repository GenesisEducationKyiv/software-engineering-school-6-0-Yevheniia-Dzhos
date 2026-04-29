import { query } from '../db/client.js';
import { AppError } from '../utils/errors.js';
import { generateToken } from '../utils/tokens.js';
import { isValidEmail, isValidRepo, isValidToken } from '../utils/validators.js';
import { ensureRepositoryExists, fetchLatestReleaseTag } from './githubService.js';
import { sendConfirmationEmail } from './emailService.js';

async function findSubscriptionByToken(column, token) {
  const result = await query(
    `SELECT s.*, r.full_name AS repo, r.last_seen_tag
     FROM subscriptions s
     JOIN repositories r ON r.id = s.repository_id
     WHERE s.${column} = $1`,
    [token]
  );
  return result.rows[0] || null;
}

export async function createSubscription({ email, repo }) {
  email = String(email || '').trim().toLowerCase();
  repo = String(repo || '').trim();

  if (!isValidEmail(email)) throw new AppError(400, 'Invalid email');
  if (!isValidRepo(repo)) throw new AppError(400, 'Invalid repo format');

  await ensureRepositoryExists(repo);

  const [owner, name] = repo.split('/');
  const latestTag = await fetchLatestReleaseTag(repo);

  await query(
    `INSERT INTO repositories (full_name, owner, name, last_seen_tag, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (full_name)
     DO UPDATE SET updated_at = NOW()`,
    [repo, owner, name, latestTag]
  );

  const repository = await query('SELECT id FROM repositories WHERE full_name = $1', [repo]);
  const repositoryId = repository.rows[0].id;

  const existing = await query(
    `SELECT * FROM subscriptions
     WHERE email = $1 AND repository_id = $2 AND unsubscribed_at IS NULL`,
    [email, repositoryId]
  );
  if (existing.rows[0]) throw new AppError(409, 'Email already subscribed to this repository');

  const confirmToken = generateToken();
  const unsubscribeToken = generateToken();

  await query(
    `INSERT INTO subscriptions (email, repository_id, confirm_token, unsubscribe_token)
     VALUES ($1, $2, $3, $4)`,
    [email, repositoryId, confirmToken, unsubscribeToken]
  );

  await sendConfirmationEmail(email, confirmToken, repo);
}

export async function confirmSubscription(token) {
  if (!isValidToken(token)) throw new AppError(400, 'Invalid token');

  const subscription = await findSubscriptionByToken('confirm_token', token);
  if (!subscription) throw new AppError(404, 'Token not found');

  await query(
    `UPDATE subscriptions
     SET confirmed = TRUE, confirmed_at = COALESCE(confirmed_at, NOW())
     WHERE id = $1`,
    [subscription.id]
  );
}

export async function unsubscribe(token) {
  if (!isValidToken(token)) throw new AppError(400, 'Invalid token');

  const subscription = await findSubscriptionByToken('unsubscribe_token', token);
  if (!subscription) throw new AppError(404, 'Token not found');

  await query(
    `UPDATE subscriptions
     SET unsubscribed_at = COALESCE(unsubscribed_at, NOW())
     WHERE id = $1`,
    [subscription.id]
  );
}

export async function listSubscriptions(email) {
  email = String(email || '').trim().toLowerCase();
  if (!isValidEmail(email)) throw new AppError(400, 'Invalid email');

  const result = await query(
    `SELECT s.email, r.full_name AS repo, s.confirmed, r.last_seen_tag
     FROM subscriptions s
     JOIN repositories r ON r.id = s.repository_id
     WHERE s.email = $1 AND s.unsubscribed_at IS NULL
     ORDER BY r.full_name`,
    [email]
  );

  return result.rows.map((row) => ({
    email: row.email,
    repo: row.repo,
    confirmed: row.confirmed,
    last_seen_tag: row.last_seen_tag
  }));
}
