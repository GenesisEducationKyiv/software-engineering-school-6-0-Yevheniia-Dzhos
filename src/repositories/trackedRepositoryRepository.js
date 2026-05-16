import { query } from '../db/client.js';

export async function upsertTrackedRepository(repo, owner, name, latestTag) {
    await query(
        `INSERT INTO repositories (full_name, owner, name, last_seen_tag, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (full_name)
     DO UPDATE SET updated_at = NOW()`,
        [repo, owner, name, latestTag]
    );
}

export async function findTrackedRepositoryByFullName(repo) {
    const result = await query(
        'SELECT id FROM repositories WHERE full_name = $1',
        [repo]
    );

    return result.rows[0] || null;
}

export async function findRepositoriesWithActiveSubscriptions() {
    const result = await query(
        `SELECT DISTINCT r.id, r.full_name, r.last_seen_tag
     FROM repositories r
     JOIN subscriptions s ON s.repository_id = r.id
     WHERE s.confirmed = TRUE AND s.unsubscribed_at IS NULL`
    );

    return result.rows;
}

export async function updateLastSeenTag(repositoryId, latestTag) {
    await query(
        `UPDATE repositories
     SET last_seen_tag = $1, updated_at = NOW()
     WHERE id = $2`,
        [latestTag, repositoryId]
    );
}