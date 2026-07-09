import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';

function createHeaders() {
    const headers = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'github-release-notifier'
    };

    if (env.githubToken) {
        headers.Authorization = `Bearer ${env.githubToken}`;
    }

    return headers;
}

export async function githubGet(path) {
    let response;
    try {
        response = await fetch(`${env.githubApiUrl}${path}`, {
            headers: createHeaders(),
            signal: AbortSignal.timeout(env.githubRequestTimeoutMs)
        });
    } catch {
        throw new AppError(502, 'GitHub API unavailable');
    }

    if (
        response.status === 429 ||
        (
            response.status === 403 &&
            response.headers.get('x-ratelimit-remaining') === '0'
        )
    ) {
        throw new AppError(429, 'GitHub API rate limit exceeded');
    }

    return response;
}
