import { generateToken } from '../utils/tokens.js';

export function createSubscriptionTokens() {
    return {
        confirmToken: generateToken(),
        unsubscribeToken: generateToken()
    };
}