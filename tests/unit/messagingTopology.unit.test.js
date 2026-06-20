import { describe, expect, it, vi } from 'vitest';
import {
  assertNotificationTopology,
  notificationCommands,
  sagaReplyEvents
} from '../../src/modules/messaging/topology.js';

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
  sagaReplyExchange: 'saga.replies',
  sagaReplyQueue: 'saga.replies',
  sagaReplyRetryExchange: 'saga.replies.retry',
  sagaReplyRetryQueue: 'saga.replies.retry',
  sagaReplyDeadLetterExchange: 'saga.replies.dead-letter',
  sagaReplyDeadLetterQueue: 'saga.replies.dead-letter',
  retryTtlMs: 5000
};


describe('notification messaging topology', () => {
  it('defines notification command routing keys', () => {
    expect(notificationCommands).toEqual({
      subscriptionConfirmation: 'notification.subscription-confirmation.send',
      release: 'notification.release.send'
    });
  });

  it('defines saga reply routing keys', () => {
    expect(sagaReplyEvents).toEqual({
      subscriptionConfirmationSucceeded: 'saga.subscription-confirmation.succeeded',
      subscriptionConfirmationFailed: 'saga.subscription-confirmation.failed'
    });
  });

  it('asserts durable notification, retry and dead-letter topology', async () => {
    const channel = createChannel();

    await assertNotificationTopology(channel, config);

    expect(channel.assertExchange).toHaveBeenCalledTimes(6);
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
    expect(channel.assertQueue).toHaveBeenCalledWith('saga.replies', {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'saga.replies.retry'
      }
    });
    expect(channel.assertQueue).toHaveBeenCalledWith('saga.replies.retry', {
      durable: true,
      arguments: {
        'x-message-ttl': 5000,
        'x-dead-letter-exchange': 'saga.replies'
      }
    });
    expect(channel.assertQueue).toHaveBeenCalledWith('saga.replies.dead-letter', {
      durable: true
    });
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'saga.replies',
      'saga.replies',
      'saga.#'
    );
    expect(channel.bindQueue).toHaveBeenCalledTimes(6);
  });
});
