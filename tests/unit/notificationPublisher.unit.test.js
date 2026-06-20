import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createConfirmChannel = vi.fn();
const logger = { error: vi.fn() };
const topology = {
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

const { createNotificationPublisher } = await import(
  '../../src/modules/messaging/notificationPublisher.js'
);

function createChannel() {
  const channel = new EventEmitter();
  channel.assertExchange = vi.fn().mockResolvedValue(undefined);
  channel.assertQueue = vi.fn().mockResolvedValue(undefined);
  channel.bindQueue = vi.fn().mockResolvedValue(undefined);
  channel.close = vi.fn().mockResolvedValue(undefined);
  channel.publish = vi.fn((_exchange, _key, _content, _options, callback) => {
    callback();
    return true;
  });
  return channel;
}

describe('notification publisher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('publishes persistent commands after broker confirmation', async () => {
    const channel = createChannel();
    createConfirmChannel.mockResolvedValue(channel);
    const publisher = createNotificationPublisher({
      brokerClient: { createConfirmChannel },
      topology,
      logger
    });

    const command = await publisher.publish('notification.release.send', {
      email: 'user@example.com',
      repo: 'owner/repo',
      tag: 'v1.0.0',
      unsubscribeToken: 'unsubscribe-token'
    });

    expect(command).toMatchObject({
      id: expect.any(String),
      type: 'notification.release.send',
      occurredAt: expect.any(String)
    });
    expect(channel.publish).toHaveBeenCalledWith(
      'notifications',
      'notification.release.send',
      expect.any(Buffer),
      expect.objectContaining({
        contentType: 'application/json',
        persistent: true,
        messageId: command.id,
        type: command.type
      }),
      expect.any(Function)
    );
  });

  it('returns a 502 application error when publishing fails', async () => {
    const channel = createChannel();
    channel.publish.mockImplementation(
      (_exchange, _key, _content, _options, callback) => {
        callback(new Error('broker unavailable'));
        return false;
      }
    );
    createConfirmChannel.mockResolvedValue(channel);
    const publisher = createNotificationPublisher({
      brokerClient: { createConfirmChannel },
      topology,
      logger
    });

    await expect(publisher.publish('notification.release.send', {}))
      .rejects.toMatchObject({
        status: 502,
        message: 'Notification service unavailable'
      });
  });

  it('closes a channel that resolves while shutdown is in progress', async () => {
    let resolveChannel;
    const channel = createChannel();
    createConfirmChannel.mockReturnValue(new Promise((resolve) => {
      resolveChannel = resolve;
    }));
    const publisher = createNotificationPublisher({
      brokerClient: { createConfirmChannel },
      topology,
      logger
    });

    const publishing = publisher.publish('notification.release.send', {});
    const closing = publisher.close();
    resolveChannel(channel);

    await publishing;
    await closing;

    expect(channel.close).toHaveBeenCalledTimes(1);
  });
});
