export function createBrokerConsumerRuntime({
  brokerClient,
  topology,
  queue,
  reconnectDelayMs,
  logger,
  name,
  assertTopology,
  handleMessage,
  onInFlightChange = () => { }
}) {
  let channel;
  let consumerTag;
  let restartTimer;
  let starting;
  let closing = false;
  const inFlight = new Set();

  function scheduleRestart() {
    if (closing || restartTimer) return;

    restartTimer = setTimeout(() => {
      restartTimer = undefined;
      void start().catch((error) => {
        logger.error(`${name} restart failed`, { error });
        scheduleRestart();
      });
    }, reconnectDelayMs);
  }

  function reportInFlight() {
    onInFlightChange(inFlight.size);
  }

  function consumeMessage(message, deliveryChannel) {
    const task = handleMessage(message, deliveryChannel);
    inFlight.add(task);
    reportInFlight();
    void task.then(
      () => { inFlight.delete(task); reportInFlight(); },
      () => { inFlight.delete(task); reportInFlight(); }
    );
    return task;
  }

  async function start() {
    if (channel) return;
    if (starting) return starting;

    starting = brokerClient.createConfirmChannel()
      .then(async (nextChannel) => {
        await assertTopology(nextChannel, topology);
        await nextChannel.prefetch(1);
        channel = nextChannel;
        nextChannel.on('error', (error) => {
          logger.error(`${name} channel error`, { error });
        });
        nextChannel.on('close', () => {
          channel = undefined;
          consumerTag = undefined;
          scheduleRestart();
        });
        const consumer = await nextChannel.consume(
          queue,
          (message) => consumeMessage(message, nextChannel),
          { noAck: false }
        );
        consumerTag = consumer.consumerTag;
      })
      .catch(async (error) => {
        const failedChannel = channel;
        channel = undefined;
        consumerTag = undefined;
        if (failedChannel) await failedChannel.close().catch(() => undefined);
        throw error;
      })
      .finally(() => {
        starting = undefined;
      });

    return starting;
  }

  async function close() {
    closing = true;
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = undefined;
    }
    if (starting) await starting.catch(() => undefined);
    const currentChannel = channel;
    const currentConsumerTag = consumerTag;
    if (currentChannel && currentConsumerTag) {
      await currentChannel.cancel(currentConsumerTag).catch(() => undefined);
    }
    await Promise.allSettled(inFlight);
    if (currentChannel) await currentChannel.close().catch(() => undefined);
    channel = undefined;
    consumerTag = undefined;
  }

  return { start, close };
}
