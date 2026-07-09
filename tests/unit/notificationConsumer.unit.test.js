import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';

vi.mock('../../services/notification-service/src/notificationService.js', () => ({
  sendSubscriptionConfirmation: vi.fn(),
  sendReleaseNotification: vi.fn()
}));
vi.mock('../../services/notification-service/src/processedMessageRepository.js', () => ({
  hasProcessedMessage: vi.fn(),
  recordProcessedMessage: vi.fn(),
  markProcessedMessageSent: vi.fn(),
  deleteProcessedMessage: vi.fn()
}));

const notificationService = await import(
  '../../services/notification-service/src/notificationService.js'
);
const processedMessages = await import(
  '../../services/notification-service/src/processedMessageRepository.js'
);
const { createNotificationConsumer } = await import(
  '../../services/notification-service/src/consumer.js'
);


function createChannel() {
  return Object.assign(new EventEmitter(), {
    assertExchange: vi.fn().mockResolvedValue(undefined),
    assertQueue: vi.fn().mockResolvedValue(undefined),
    bindQueue: vi.fn().mockResolvedValue(undefined),
    prefetch: vi.fn().mockResolvedValue(undefined),
    consume: vi.fn().mockResolvedValue({ consumerTag: 'consumer-1' }),
    publish: vi.fn().mockReturnValue(true),
    waitForConfirms: vi.fn().mockResolvedValue(undefined),
    ack: vi.fn(),
    nack: vi.fn(),
    cancel: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined)
  });
}

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
  retryTtlMs: 5000,
  maxAttempts: 3
};

function createMessage(type, payload, id = 'message-1', attempts = 1) {
  return {
    content: Buffer.from(JSON.stringify({ id, type, payload })),
    fields: { routingKey: type },
    properties: {
      messageId: id,
      type,
      headers: attempts > 1 ? {
        'x-death': [{ queue: topology.queue, count: attempts - 1 }]
      } : {}
    }
  };
}

describe('notification consumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processedMessages.hasProcessedMessage.mockResolvedValue(false);
    processedMessages.recordProcessedMessage.mockResolvedValue(true);
    processedMessages.markProcessedMessageSent.mockResolvedValue(undefined);
  });

  it('consumes and acknowledges subscription confirmation commands', async () => {
    const channel = createChannel();
    const consumer = createNotificationConsumer({
      brokerClient: { createConfirmChannel: vi.fn().mockResolvedValue(channel) },
      topology,
      reconnectDelayMs: 1000,
      logger: { error: vi.fn() }
    });

    await consumer.start();
    const handleMessage = channel.consume.mock.calls[0][1];
    const message = createMessage('notification.subscription-confirmation.send', {
      email: 'user@example.com',
      token: 'token-123',
      repo: 'owner/repo',
      sagaId: 'saga-1'
    });
    await handleMessage(message);

    expect(channel.prefetch).toHaveBeenCalledWith(1);
    expect(notificationService.sendSubscriptionConfirmation)
      .toHaveBeenCalledWith('user@example.com', 'token-123', 'owner/repo', 'message-1');
    expect(processedMessages.recordProcessedMessage)
      .toHaveBeenCalledWith('message-1', 'notification.subscription-confirmation.send');
    expect(processedMessages.markProcessedMessageSent).toHaveBeenCalledWith('message-1');
    expect(channel.publish).toHaveBeenCalledWith(
      'saga.replies',
      'saga.subscription-confirmation.succeeded',
      expect.any(Buffer),
      expect.objectContaining({
        messageId: 'message-1:saga.subscription-confirmation.succeeded',
        type: 'saga.subscription-confirmation.succeeded'
      })
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('reports the in-flight message count via setNotificationMessagesInFlight', async () => {
    let resolveDelivery;
    notificationService.sendReleaseNotification.mockReturnValue(
      new Promise((resolve) => {
        resolveDelivery = resolve;
      })
    );
    const channel = createChannel();
    const setNotificationMessagesInFlight = vi.fn();
    const consumer = createNotificationConsumer({
      brokerClient: { createConfirmChannel: vi.fn().mockResolvedValue(channel) },
      topology,
      reconnectDelayMs: 1000,
      logger: { error: vi.fn() },
      setNotificationMessagesInFlight
    });

    await consumer.start();
    const delivery = channel.consume.mock.calls[0][1](
      createMessage('notification.release.send', {
        email: 'user@example.com',
        repo: 'owner/repo',
        tag: 'v1.0.0',
        unsubscribeToken: 'unsubscribe-token'
      })
    );

    expect(setNotificationMessagesInFlight).toHaveBeenLastCalledWith(1);

    resolveDelivery();
    await delivery;

    expect(setNotificationMessagesInFlight).toHaveBeenLastCalledWith(0);
  });

  it('rejects failed commands for retry', async () => {
    notificationService.sendReleaseNotification
      .mockRejectedValue(new Error('SMTP unavailable'));
    const channel = createChannel();
    const logger = { error: vi.fn() };
    const consumer = createNotificationConsumer({
      brokerClient: { createConfirmChannel: vi.fn().mockResolvedValue(channel) },
      topology,
      reconnectDelayMs: 1000,
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
      expect.objectContaining({
        messageId: 'message-1',
        attempt: 1,
        error: expect.any(Error)
      })
    );
    expect(processedMessages.recordProcessedMessage)
      .toHaveBeenCalledWith('message-1', 'notification.release.send');
    expect(processedMessages.markProcessedMessageSent).not.toHaveBeenCalled();
    expect(processedMessages.deleteProcessedMessage).toHaveBeenCalledWith('message-1');
  });

  it('acknowledges already processed commands without sending another email', async () => {
    processedMessages.hasProcessedMessage.mockResolvedValue(true);
    const channel = createChannel();
    const consumer = createNotificationConsumer({
      brokerClient: { createConfirmChannel: vi.fn().mockResolvedValue(channel) },
      topology,
      reconnectDelayMs: 1000,
      logger: { error: vi.fn() }
    });

    await consumer.start();
    const message = createMessage('notification.release.send', {
      email: 'user@example.com',
      repo: 'owner/repo',
      tag: 'v1.0.0',
      unsubscribeToken: 'unsubscribe-token'
    });
    await channel.consume.mock.calls[0][1](message);

    expect(processedMessages.hasProcessedMessage).toHaveBeenCalledWith('message-1');
    expect(notificationService.sendReleaseNotification).not.toHaveBeenCalled();
    expect(processedMessages.recordProcessedMessage).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('retries when a success saga reply cannot be published', async () => {
    processedMessages.hasProcessedMessage.mockResolvedValue(true);
    const channel = createChannel();
    channel.waitForConfirms.mockRejectedValue(new Error('RabbitMQ unavailable'));
    const consumer = createNotificationConsumer({
      brokerClient: { createConfirmChannel: vi.fn().mockResolvedValue(channel) },
      topology,
      reconnectDelayMs: 1000,
      logger: { error: vi.fn() }
    });

    await consumer.start();
    const message = createMessage('notification.subscription-confirmation.send', {
      email: 'user@example.com',
      token: 'token-123',
      repo: 'owner/repo',
      sagaId: 'saga-1'
    });
    await channel.consume.mock.calls[0][1](message);

    expect(notificationService.sendSubscriptionConfirmation).not.toHaveBeenCalled();
    expect(channel.publish).toHaveBeenCalledWith(
      'saga.replies',
      'saga.subscription-confirmation.succeeded',
      expect.any(Buffer),
      expect.objectContaining({
        type: 'saga.subscription-confirmation.succeeded'
      })
    );
    expect(channel.publish).not.toHaveBeenCalledWith(
      'saga.replies',
      'saga.subscription-confirmation.failed',
      expect.any(Buffer),
      expect.any(Object)
    );
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });

  it('acknowledges commands that were claimed by another consumer', async () => {
    processedMessages.recordProcessedMessage.mockResolvedValue(false);
    const channel = createChannel();
    const consumer = createNotificationConsumer({
      brokerClient: { createConfirmChannel: vi.fn().mockResolvedValue(channel) },
      topology,
      reconnectDelayMs: 1000,
      logger: { error: vi.fn() }
    });

    await consumer.start();
    const message = createMessage('notification.release.send', {
      email: 'user@example.com',
      repo: 'owner/repo',
      tag: 'v1.0.0',
      unsubscribeToken: 'unsubscribe-token'
    });
    await channel.consume.mock.calls[0][1](message);

    expect(notificationService.sendReleaseNotification).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('moves a command to the dead-letter exchange after the final attempt', async () => {
    notificationService.sendSubscriptionConfirmation
      .mockRejectedValue(new Error('SMTP unavailable'));
    const channel = createChannel();
    const consumer = createNotificationConsumer({
      brokerClient: { createConfirmChannel: vi.fn().mockResolvedValue(channel) },
      topology,
      reconnectDelayMs: 1000,
      logger: { error: vi.fn() }
    });

    await consumer.start();
    const message = createMessage('notification.subscription-confirmation.send', {
      email: 'user@example.com',
      token: 'token-123',
      repo: 'owner/repo',
      sagaId: 'saga-1'
    }, 'message-1', 3);
    await channel.consume.mock.calls[0][1](message);

    expect(channel.publish).toHaveBeenCalledWith(
      'saga.replies',
      'saga.subscription-confirmation.failed',
      expect.any(Buffer),
      expect.objectContaining({
        messageId: 'message-1:saga.subscription-confirmation.failed',
        type: 'saga.subscription-confirmation.failed'
      })
    );
    expect(channel.publish).toHaveBeenCalledWith(
      topology.deadLetterExchange,
      'notification.subscription-confirmation.send',
      message.content,
      message.properties
    );
    expect(channel.waitForConfirms).toHaveBeenCalledTimes(2);
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('retries final failures when the failure saga reply cannot be published', async () => {
    notificationService.sendSubscriptionConfirmation
      .mockRejectedValue(new Error('SMTP unavailable'));
    const channel = createChannel();
    channel.waitForConfirms
      .mockRejectedValueOnce(new Error('RabbitMQ unavailable'))
      .mockResolvedValueOnce(undefined);
    const consumer = createNotificationConsumer({
      brokerClient: { createConfirmChannel: vi.fn().mockResolvedValue(channel) },
      topology,
      reconnectDelayMs: 1000,
      logger: { error: vi.fn() }
    });

    await consumer.start();
    const message = createMessage('notification.subscription-confirmation.send', {
      email: 'user@example.com',
      token: 'token-123',
      repo: 'owner/repo',
      sagaId: 'saga-1'
    }, 'message-1', 3);
    await channel.consume.mock.calls[0][1](message);

    expect(channel.publish).not.toHaveBeenCalledWith(
      topology.deadLetterExchange,
      'notification.subscription-confirmation.send',
      message.content,
      message.properties
    );
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });

  it('moves invalid commands directly to the dead-letter exchange', async () => {
    const channel = createChannel();
    const consumer = createNotificationConsumer({
      brokerClient: { createConfirmChannel: vi.fn().mockResolvedValue(channel) },
      topology,
      reconnectDelayMs: 1000,
      logger: { error: vi.fn() }
    });

    await consumer.start();
    const message = createMessage('notification.unknown.send', {});
    await channel.consume.mock.calls[0][1](message);

    expect(channel.publish).toHaveBeenCalledWith(
      topology.deadLetterExchange,
      'notification.unknown.send',
      message.content,
      message.properties
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('moves commands with invalid payload shape directly to the dead-letter exchange', async () => {
    const channel = createChannel();
    const consumer = createNotificationConsumer({
      brokerClient: { createConfirmChannel: vi.fn().mockResolvedValue(channel) },
      topology,
      reconnectDelayMs: 1000,
      logger: { error: vi.fn() }
    });

    await consumer.start();
    const message = createMessage('notification.release.send', { email: 'user@example.com' });
    await channel.consume.mock.calls[0][1](message);

    expect(notificationService.sendReleaseNotification).not.toHaveBeenCalled();
    expect(processedMessages.recordProcessedMessage).not.toHaveBeenCalled();
    expect(channel.publish).toHaveBeenCalledWith(
      topology.deadLetterExchange,
      'notification.release.send',
      message.content,
      message.properties
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('moves malformed JSON directly to the dead-letter exchange', async () => {
    const channel = createChannel();
    const consumer = createNotificationConsumer({
      brokerClient: { createConfirmChannel: vi.fn().mockResolvedValue(channel) },
      topology,
      reconnectDelayMs: 1000,
      logger: { error: vi.fn() }
    });

    await consumer.start();
    const message = {
      content: Buffer.from('{'),
      fields: { routingKey: 'notification.release.send' },
      properties: {
        messageId: 'message-1',
        type: 'notification.release.send',
        headers: {}
      }
    };
    await channel.consume.mock.calls[0][1](message);

    expect(channel.publish).toHaveBeenCalledWith(
      topology.deadLetterExchange,
      'notification.release.send',
      message.content,
      message.properties
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('restarts consumption after the channel closes', async () => {
    vi.useFakeTimers();
    const firstChannel = createChannel();
    const secondChannel = createChannel();
    const createConfirmChannel = vi.fn()
      .mockResolvedValueOnce(firstChannel)
      .mockResolvedValueOnce(secondChannel);
    const consumer = createNotificationConsumer({
      brokerClient: { createConfirmChannel },
      topology,
      reconnectDelayMs: 1000,
      logger: { error: vi.fn() }
    });

    await consumer.start();
    firstChannel.emit('close');
    await vi.advanceTimersByTimeAsync(1000);

    expect(createConfirmChannel).toHaveBeenCalledTimes(2);
    expect(secondChannel.consume).toHaveBeenCalledWith(
      topology.queue,
      expect.any(Function),
      { noAck: false }
    );
    await consumer.close();
    vi.useRealTimers();
  });

  it('waits for in-flight commands before closing the channel', async () => {
    let finishDelivery;
    notificationService.sendReleaseNotification.mockReturnValue(
      new Promise((resolve) => {
        finishDelivery = resolve;
      })
    );
    const channel = createChannel();
    const consumer = createNotificationConsumer({
      brokerClient: { createConfirmChannel: vi.fn().mockResolvedValue(channel) },
      topology,
      reconnectDelayMs: 1000,
      logger: { error: vi.fn() }
    });

    await consumer.start();
    const delivery = channel.consume.mock.calls[0][1](
      createMessage('notification.release.send', {
        email: 'user@example.com',
        repo: 'owner/repo',
        tag: 'v1.0.0',
        unsubscribeToken: 'unsubscribe-token'
      })
    );
    const closing = consumer.close();
    await Promise.resolve();

    expect(channel.cancel).toHaveBeenCalledWith('consumer-1');
    expect(channel.close).not.toHaveBeenCalled();

    finishDelivery();
    await delivery;
    await closing;

    expect(channel.close).toHaveBeenCalledTimes(1);
  });

  it('still drains in-flight commands when the channel closes out from under close()', async () => {
    let finishDelivery;
    notificationService.sendReleaseNotification.mockReturnValue(
      new Promise((resolve) => {
        finishDelivery = resolve;
      })
    );
    const channel = createChannel();
    channel.cancel.mockRejectedValue(new Error('channel closed'));
    channel.close.mockRejectedValue(new Error('channel closed'));
    const consumer = createNotificationConsumer({
      brokerClient: { createConfirmChannel: vi.fn().mockResolvedValue(channel) },
      topology,
      reconnectDelayMs: 1000,
      logger: { error: vi.fn() }
    });

    await consumer.start();
    const delivery = channel.consume.mock.calls[0][1](
      createMessage('notification.release.send', {
        email: 'user@example.com',
        repo: 'owner/repo',
        tag: 'v1.0.0',
        unsubscribeToken: 'unsubscribe-token'
      })
    );
    const closing = consumer.close();

    finishDelivery();
    await delivery;

    await expect(closing).resolves.toBeUndefined();
  });
});
