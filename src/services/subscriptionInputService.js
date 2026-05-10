import { AppError } from '../utils/errors.js';
import { isValidEmail, isValidRepo, isValidToken } from '../utils/validators.js';

export function normalizeSubscriptionInput({ email, repo }) {
    return {
        email: String(email || '').trim().toLowerCase(),
        repo: String(repo || '').trim()
    };
}

export function validateSubscriptionInput({ email, repo }) {
    if (!isValidEmail(email)) {
        throw new AppError(400, 'Invalid email');
    }

    if (!isValidRepo(repo)) {
        throw new AppError(400, 'Invalid repo format');
    }
}

export function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

export function validateEmail(email) {
    if (!isValidEmail(email)) {
        throw new AppError(400, 'Invalid email');
    }
}

export function validateToken(token) {
    if (!isValidToken(token)) {
        throw new AppError(400, 'Invalid token');
    }
}