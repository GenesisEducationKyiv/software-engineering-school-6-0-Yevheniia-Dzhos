import { randomUUID } from 'node:crypto';
import { AppError } from '../../utils/errors.js';
import { assertNotificationTopology } from './topology.js';

export function createNotificationPublisher({
  brokerClient,
  topology,
  logger
}) {
  let channel;
  let channelPromise;
  let closing = false;
  const inFlight = new Set();

  async function getChannel() {
    if (closing) throw new Error('Notification publisher is closed');
    if (channel) return channel;
    if (channelPromise) return channelPromise;

    channelPromise = brokerClient.createConfirmChannel()
      .then(async (nextChannel) => {
        await assertNotificationTopology(nextChannel, topology);
        nextChannel.on('close', () => {
          channel = undefined;
        });
        nextChannel.on('error', (error) => {
          logger.error('Notification publisher channel error', { error });
        });
        channel = nextChannel;
        channelPromise = undefined;
        return nextChannel;
      })
      .catch((error) => {
        channelPromise = undefined;
        throw error;
      });

    return channelPromise;
  }

  async function publishCommand(type, payload) {
    const command = {
      id: randomUUID(),
      type,
      occurredAt: new Date().toISOString(),
      payload
    };

    try {
      const confirmChannel = await getChannel();
      await new Promise((resolve, reject) => {
        confirmChannel.publish(
          topology.exchange,
          type,
          Buffer.from(JSON.stringify(command)),
          {
            contentType: 'application/json',
            persistent: true,
            messageId: command.id,
            type,
            timestamp: Date.now()
          },
          (error) => error ? reject(error) : resolve()
        );
      });
      return command;
    } catch (error) {
      logger.error('Notification command publishing failed', { type, error });
      throw new AppError(502, 'Notification service unavailable');
    }
  }

  function publish(type, payload) {
    const task = publishCommand(type, payload);
    inFlight.add(task);
    void task.then(
      () => inFlight.delete(task),
      () => inFlight.delete(task)
    );
    return task;
  }

  async function close() {
    closing = true;
    const pendingChannel = channelPromise;
    const currentChannel = channel
      ?? await pendingChannel?.catch(() => undefined);
    await Promise.allSettled(inFlight);
    channel = undefined;
    channelPromise = undefined;
    if (currentChannel) await currentChannel.close();
  }

  return { publish, close };
}
