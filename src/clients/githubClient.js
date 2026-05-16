import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

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
    const response = await fetch(`${env.githubApiUrl}${path}`, {
        headers: createHeaders()
    });

    if (
        response.status === 429 ||
        response.headers.get('x-ratelimit-remaining') === '0'
    ) {
        throw new AppError(429, 'GitHub API rate limit exceeded');
    }

    return response;
}