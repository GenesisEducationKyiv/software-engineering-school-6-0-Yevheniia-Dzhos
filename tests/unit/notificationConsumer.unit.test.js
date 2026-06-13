import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/notification-service/src/notificationService.js', () => ({
  sendSubscriptionConfirmation: vi.fn(),
  sendReleaseNotification: vi.fn()
}));

const notificationService = await import(
  '../../services/notification-service/src/notificationService.js'
);
const { createNotificationConsumer } = await import(
  '../../services/notification-service/src/consumer.js'
);


function createChannel() {
  return {
    assertExchange: vi.fn().mockResolvedValue(undefined),
    assertQueue: vi.fn().mockResolvedValue(undefined),
    bindQueue: vi.fn().mockResolvedValue(undefined),
    prefetch: vi.fn().mockResolvedValue(undefined),
    consume: vi.fn().mockResolvedValue({ consumerTag: 'consumer-1' }),
    ack: vi.fn(),
    nack: vi.fn(),
    cancel: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined)
  };
}

const topology = {
  exchange: 'notifications',
  queue: 'notifications',
  retryExchange: 'notifications.retry',
  retryQueue: 'notifications.retry',
  deadLetterExchange: 'notifications.dead-letter',
  deadLetterQueue: 'notifications.dead-letter',
  retryTtlMs: 5000
};

function createMessage(type, payload, id = 'message-1') {
  return {
    content: Buffer.from(JSON.stringify({ id, type, payload })),
    properties: { messageId: id, type }
  };
}

describe('notification consumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('consumes and acknowledges subscription confirmation commands', async () => {
    const channel = createChannel();
    const consumer = createNotificationConsumer({
      brokerClient: { createChannel: vi.fn().mockResolvedValue(channel) },
      topology,
      logger: { error: vi.fn() }
    });

    await consumer.start();
    const handleMessage = channel.consume.mock.calls[0][1];
    const message = createMessage('notification.subscription-confirmation.send', {
      email: 'user@example.com',
      token: 'token-123',
      repo: 'owner/repo'
    });
    await handleMessage(message);

    expect(channel.prefetch).toHaveBeenCalledWith(1);
    expect(notificationService.sendSubscriptionConfirmation)
      .toHaveBeenCalledWith('user@example.com', 'token-123', 'owner/repo');
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('rejects failed commands for retry', async () => {
    notificationService.sendReleaseNotification
      .mockRejectedValue(new Error('SMTP unavailable'));
    const channel = createChannel();
    const logger = { error: vi.fn() };
    const consumer = createNotificationConsumer({
      brokerClient: { createChannel: vi.fn().mockResolvedValue(channel) },
      topology,
      logger
    });

    await consumer.start();
    const handleMessage = channel.consume.mock.calls[0][1];
    const message = createMessage('notification.release.send', {
      email: 'user@example.com',
      repo: 'owner/repo',
      tag: 'v1.0.0',
      unsubscribeToken: 'unsubscribe-token'
    });
    await handleMessage(message);

    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    expect(logger.error).toHaveBeenCalledWith(
      'Notification command handling failed',
      expect.objectContaining({ messageId: 'message-1', error: expect.any(Error) })
    );
  });
});
