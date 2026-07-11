import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/sagas/subscriptionConfirmationSaga.js', () => ({
  handleSubscriptionConfirmationSagaReply: vi.fn()
}));
vi.mock('../../src/modules/sagas/sagaRepository.js', () => ({
  hasProcessedSagaReply: vi.fn(),
  recordProcessedSagaReply: vi.fn()
}));

const saga = await import('../../src/modules/sagas/subscriptionConfirmationSaga.js');
const sagaRepository = await import('../../src/modules/sagas/sagaRepository.js');
const { createSagaReplyConsumer } = await import(
  '../../src/modules/sagas/sagaReplyConsumer.js'
);

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

function createReply(type, sagaId = 'saga-1') {
  return {
    content: Buffer.from(JSON.stringify({
      id: `message-1:${type}`,
      type,
      sagaId,
      commandId: 'message-1'
    })),
    properties: {
      messageId: `message-1:${type}`,
      type
    }
  };
}

describe('saga reply consumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sagaRepository.hasProcessedSagaReply.mockResolvedValue(false);
  });

  it('consumes successful saga replies and acknowledges them', async () => {
    saga.handleSubscriptionConfirmationSagaReply.mockResolvedValue({
      id: 'saga-1',
      state: 'COMPLETED'
    });
    const channel = createChannel();
    const consumer = createSagaReplyConsumer({
      brokerClient: { createConfirmChannel: vi.fn().mockResolvedValue(channel) },
      topology,
      reconnectDelayMs: 1000,
      logger: { error: vi.fn() }
    });

    await consumer.start();
    await channel.consume.mock.calls[0][1](
      createReply('saga.subscription-confirmation.succeeded')
    );

    expect(channel.consume).toHaveBeenCalledWith(
      'saga.replies',
      expect.any(Function),
      { noAck: false }
    );
    expect(saga.handleSubscriptionConfirmationSagaReply)
      .toHaveBeenCalledWith({
        sagaId: 'saga-1',
        succeeded: true
      });
    expect(sagaRepository.recordProcessedSagaReply)
      .toHaveBeenCalledWith({
        replyId: 'message-1:saga.subscription-confirmation.succeeded',
        sagaId: 'saga-1',
        replyType: 'saga.subscription-confirmation.succeeded'
      });
    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('passes failed saga replies to the orchestrator', async () => {
    const channel = createChannel();
    const consumer = createSagaReplyConsumer({
      brokerClient: { createConfirmChannel: vi.fn().mockResolvedValue(channel) },
      topology,
      reconnectDelayMs: 1000,
      logger: { error: vi.fn() }
    });

    await consumer.start();
    await channel.consume.mock.calls[0][1]({
      content: Buffer.from(JSON.stringify({
        id: 'reply-1',
        type: 'saga.subscription-confirmation.failed',
        sagaId: 'saga-1',
        error: 'SMTP unavailable'
      })),
      properties: { messageId: 'reply-1' }
    });

    expect(saga.handleSubscriptionConfirmationSagaReply)
      .toHaveBeenCalledWith({
        sagaId: 'saga-1',
        succeeded: false,
        error: 'SMTP unavailable'
      });
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });

  it('acknowledges orphan replies for an unknown saga without recording them', async () => {
    saga.handleSubscriptionConfirmationSagaReply.mockResolvedValue(null);
    const channel = createChannel();
    const consumer = createSagaReplyConsumer({
      brokerClient: { createConfirmChannel: vi.fn().mockResolvedValue(channel) },
      topology,
      reconnectDelayMs: 1000,
      logger: { error: vi.fn() }
    });

    await consumer.start();
    const message = createReply('saga.subscription-confirmation.succeeded', 'unknown-saga');
    await channel.consume.mock.calls[0][1](message);

    expect(sagaRepository.recordProcessedSagaReply).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('acknowledges replies with an unrecognized type', async () => {
    const channel = createChannel();
    const consumer = createSagaReplyConsumer({
      brokerClient: { createConfirmChannel: vi.fn().mockResolvedValue(channel) },
      topology,
      reconnectDelayMs: 1000,
      logger: { error: vi.fn() }
    });

    await consumer.start();
    const message = createReply('saga.unknown.event');
    await channel.consume.mock.calls[0][1](message);

    expect(saga.handleSubscriptionConfirmationSagaReply).not.toHaveBeenCalled();
    expect(sagaRepository.recordProcessedSagaReply).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('acknowledges malformed replies without requeueing them', async () => {
    const channel = createChannel();
    const consumer = createSagaReplyConsumer({
      brokerClient: { createConfirmChannel: vi.fn().mockResolvedValue(channel) },
      topology,
      reconnectDelayMs: 1000,
      logger: { error: vi.fn() }
    });

    await consumer.start();
    const message = {
      content: Buffer.from('{'),
      properties: { messageId: 'bad-reply-1' }
    };
    await channel.consume.mock.calls[0][1](message);

    expect(saga.handleSubscriptionConfirmationSagaReply).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('sends failed saga reply handling through the retry queue', async () => {
    saga.handleSubscriptionConfirmationSagaReply
      .mockRejectedValue(new Error('Database unavailable'));
    const channel = createChannel();
    const consumer = createSagaReplyConsumer({
      brokerClient: { createConfirmChannel: vi.fn().mockResolvedValue(channel) },
      topology,
      reconnectDelayMs: 1000,
      logger: { error: vi.fn() }
    });

    await consumer.start();
    const message = createReply('saga.subscription-confirmation.succeeded');
    await channel.consume.mock.calls[0][1](message);

    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });

  it('moves saga replies to dead-letter exchange after final attempt', async () => {
    saga.handleSubscriptionConfirmationSagaReply
      .mockRejectedValue(new Error('Database unavailable'));
    const channel = createChannel();
    const consumer = createSagaReplyConsumer({
      brokerClient: { createConfirmChannel: vi.fn().mockResolvedValue(channel) },
      topology,
      reconnectDelayMs: 1000,
      logger: { error: vi.fn() }
    });

    await consumer.start();
    const message = createReply('saga.subscription-confirmation.succeeded');
    message.fields = { routingKey: 'saga.subscription-confirmation.succeeded' };
    message.properties.headers = {
      'x-death': [{ queue: topology.sagaReplyQueue, count: 2 }]
    };
    await channel.consume.mock.calls[0][1](message);

    expect(channel.publish).toHaveBeenCalledWith(
      'saga.replies.dead-letter',
      'saga.subscription-confirmation.succeeded',
      message.content,
      message.properties
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
  });
});
