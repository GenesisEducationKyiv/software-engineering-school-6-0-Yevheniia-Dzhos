import amqp from 'amqplib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertNotificationTopology } from '../../src/modules/messaging/topology.js';

let connection;
let channel;

const config = {
  exchange: 'notifications.integration',
  queue: 'notifications.integration',
  retryExchange: 'notifications.integration.retry',
  retryQueue: 'notifications.integration.retry',
  deadLetterExchange: 'notifications.integration.dead-letter',
  deadLetterQueue: 'notifications.integration.dead-letter',
  sagaReplyExchange: 'saga.integration.replies',
  sagaReplyQueue: 'saga.integration.replies',
  retryTtlMs: 100
};

async function waitForMessage(queue, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const message = await channel.get(queue, { noAck: false });
    if (message) return message;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out waiting for a message in ${queue}`);
}

describe('RabbitMQ notification topology', () => {
  beforeAll(async () => {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    await assertNotificationTopology(channel, config);
    await channel.purgeQueue(config.queue);
    await channel.purgeQueue(config.retryQueue);
    await channel.purgeQueue(config.deadLetterQueue);
    await channel.purgeQueue(config.sagaReplyQueue);
  });

  afterAll(async () => {
    await channel?.close();
    await connection?.close();
  });

  it('creates durable notification, retry and dead-letter queues', async () => {
    await expect(channel.checkQueue(config.queue)).resolves.toMatchObject({
      queue: config.queue
    });
    await expect(channel.checkQueue(config.retryQueue)).resolves.toMatchObject({
      queue: config.retryQueue
    });
    await expect(channel.checkQueue(config.deadLetterQueue)).resolves.toMatchObject({
      queue: config.deadLetterQueue
    });
    await expect(channel.checkQueue(config.sagaReplyQueue)).resolves.toMatchObject({
      queue: config.sagaReplyQueue
    });
  });

  it('returns rejected commands through the retry queue with x-death metadata', async () => {
    const routingKey = 'notification.release.send';
    channel.publish(
      config.exchange,
      routingKey,
      Buffer.from(JSON.stringify({ id: 'retry-message' })),
      { persistent: true, messageId: 'retry-message', type: routingKey }
    );

    const firstDelivery = await waitForMessage(config.queue);
    channel.nack(firstDelivery, false, false);

    const retryDelivery = await waitForMessage(config.queue);
    const mainQueueDeath = retryDelivery.properties.headers['x-death'].find((entry) => {
      return entry.queue === config.queue;
    });

    expect(mainQueueDeath.count).toBe(1);
    expect(retryDelivery.fields.routingKey).toBe(routingKey);
    channel.ack(retryDelivery);
  });
});
