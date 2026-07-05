import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/tokens.js', () => ({
  generateToken: vi.fn()
}));

const { generateToken } = await import('../../src/utils/tokens.js');
const { createSubscriptionTokens } = await import('../../src/services/subscriptionTokenService.js');

describe('subscription token service', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates independent confirmation and unsubscribe tokens', () => {
    generateToken
      .mockReturnValueOnce('confirm-token-123')
      .mockReturnValueOnce('unsubscribe-token-123');

    expect(createSubscriptionTokens()).toEqual({
      confirmToken: 'confirm-token-123',
      unsubscribeToken: 'unsubscribe-token-123'
    });
    expect(generateToken).toHaveBeenCalledTimes(2);
  });
});
