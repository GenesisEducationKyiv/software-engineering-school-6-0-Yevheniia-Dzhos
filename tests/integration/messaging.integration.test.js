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
  retryTtlMs: 100
};

describe('RabbitMQ notification topology', () => {
  beforeAll(async () => {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
  });

  afterAll(async () => {
    await channel?.close();
    await connection?.close();
  });

  it('creates durable notification, retry and dead-letter queues', async () => {
    await assertNotificationTopology(channel, config);

    await expect(channel.checkQueue(config.queue)).resolves.toMatchObject({
      queue: config.queue
    });
    await expect(channel.checkQueue(config.retryQueue)).resolves.toMatchObject({
      queue: config.retryQueue
    });
    await expect(channel.checkQueue(config.deadLetterQueue)).resolves.toMatchObject({
      queue: config.deadLetterQueue
    });
  });
});
