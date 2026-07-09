import { describe, expect, it, vi } from 'vitest';
import {
  assertNotificationTopology,
  notificationCommands
} from '@notifier/shared/modules/messaging/topology.js';

function createChannel() {
  return {
    assertExchange: vi.fn().mockResolvedValue(undefined),
    assertQueue: vi.fn().mockResolvedValue(undefined),
    bindQueue: vi.fn().mockResolvedValue(undefined)
  };
}

const config = {
  exchange: 'notifications',
  queue: 'notifications',
  retryExchange: 'notifications.retry',
  retryQueue: 'notifications.retry',
  deadLetterExchange: 'notifications.dead-letter',
  deadLetterQueue: 'notifications.dead-letter',
  retryTtlMs: 5000
};


describe('notification messaging topology', () => {
  it('defines notification command routing keys', () => {
    expect(notificationCommands).toEqual({
      subscriptionConfirmation: 'notification.subscription-confirmation.send',
      release: 'notification.release.send'
    });
  });

  it('asserts durable notification, retry and dead-letter topology', async () => {
    const channel = createChannel();

    await assertNotificationTopology(channel, config);

    expect(channel.assertExchange).toHaveBeenCalledTimes(3);
    expect(channel.assertQueue).toHaveBeenCalledWith('notifications', {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'notifications.retry'
      }
    });
    expect(channel.assertQueue).toHaveBeenCalledWith('notifications.retry', {
      durable: true,
      arguments: {
        'x-message-ttl': 5000,
        'x-dead-letter-exchange': 'notifications'
      }
    });
    expect(channel.assertQueue).toHaveBeenCalledWith('notifications.dead-letter', {
      durable: true
    });
    expect(channel.bindQueue).toHaveBeenCalledTimes(3);
  });
});
