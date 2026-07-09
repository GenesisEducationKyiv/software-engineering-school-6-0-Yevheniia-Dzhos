import { query } from '../../db/client.js';

const allowedTokenColumns = ['confirm_token', 'unsubscribe_token'];

export async function findActiveSubscription(email, repositoryId) {
    const result = await query(
        `SELECT * FROM subscriptions
     WHERE email = $1 AND repository_id = $2 AND unsubscribed_at IS NULL`,
        [email, repositoryId]
    );

    return result.rows[0] || null;
}

export async function createSubscriptionRecord(
    email,
    repositoryId,
    confirmToken,
    unsubscribeToken,
    client
) {
    const executor = client || { query };
    const result = await executor.query(
        `INSERT INTO subscriptions (email, repository_id, confirm_token, unsubscribe_token)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
        [email, repositoryId, confirmToken, unsubscribeToken]
    );

    return result.rows[0];
}

export async function findSubscriptionByToken(column, token) {
    if (!allowedTokenColumns.includes(column)) {
        throw new Error('Invalid token column');
    }

    const result = await query(
        `SELECT s.*, r.full_name AS repo, r.last_seen_tag
     FROM subscriptions s
     JOIN repositories r ON r.id = s.repository_id
     WHERE s.${column} = $1`,
        [token]
    );

    return result.rows[0] || null;
}

export async function confirmSubscriptionRecord(id) {
    await query(
        `UPDATE subscriptions
     SET confirmed = TRUE, confirmed_at = COALESCE(confirmed_at, NOW())
     WHERE id = $1`,
        [id]
    );
}

export async function unsubscribeSubscriptionRecord(id) {
    await query(
        `UPDATE subscriptions
     SET unsubscribed_at = COALESCE(unsubscribed_at, NOW())
     WHERE id = $1`,
        [id]
    );
}

export async function deletePendingSubscription(id) {
    const result = await query(
        `DELETE FROM subscriptions
     WHERE id = $1 AND confirmed = FALSE
     RETURNING *`,
        [id]
    );

    return result.rows[0] || null;
}

export async function listSubscriptionsByEmail(email) {
    const result = await query(
        `SELECT s.email, r.full_name AS repo, s.confirmed, r.last_seen_tag
     FROM subscriptions s
     JOIN repositories r ON r.id = s.repository_id
     WHERE s.email = $1 AND s.unsubscribed_at IS NULL
     ORDER BY r.full_name`,
        [email]
    );

    return result.rows;
}

export async function findActiveSubscribersByRepositoryId(repositoryId) {
    const result = await query(
        `SELECT email, unsubscribe_token
     FROM subscriptions
     WHERE repository_id = $1
       AND confirmed = TRUE
       AND unsubscribed_at IS NULL`,
        [repositoryId]
    );

    return result.rows;
}
