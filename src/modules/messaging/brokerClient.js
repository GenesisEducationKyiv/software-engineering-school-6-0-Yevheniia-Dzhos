import amqp from 'amqplib';

export function createBrokerClient({ url, reconnectDelayMs, logger }) {
  let connection;
  let connecting;
  let reconnectTimer;
  let closing = false;

  function scheduleReconnect() {
    if (closing || reconnectTimer) return;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      void connect().catch((error) => {
        logger.error('Message broker reconnect failed', { error });
        scheduleReconnect();
      });
    }, reconnectDelayMs);
  }

  async function connect() {
    if (connection) return connection;
    if (connecting) return connecting;

    connecting = amqp.connect(url)
      .then((nextConnection) => {
        connection = nextConnection;
        connecting = undefined;

        nextConnection.on('error', (error) => {
          logger.error('Message broker connection error', { error });
        });
        nextConnection.on('close', () => {
          connection = undefined;
          logger.warn('Message broker connection closed');
          scheduleReconnect();
        });

        return nextConnection;
      })
      .catch((error) => {
        connecting = undefined;
        throw error;
      });

    return connecting;
  }

  async function createChannel() {
    return (await connect()).createChannel();
  }

  async function createConfirmChannel() {
    return (await connect()).createConfirmChannel();
  }

  function isConnected() {
    return Boolean(connection);
  }

  async function close() {
    closing = true;

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }

    const pendingConnection = connecting;
    const currentConnection = connection
      ?? await pendingConnection?.catch(() => undefined);
    connection = undefined;
    connecting = undefined;

    if (currentConnection) {
      await currentConnection.close();
    }
  }

  return {
    connect,
    createChannel,
    createConfirmChannel,
    isConnected,
    close
  };
}
