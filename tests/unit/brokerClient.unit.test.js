import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const connect = vi.fn();

vi.mock('amqplib', () => ({
  default: { connect }
}));

const { createBrokerClient } = await import('../../src/modules/messaging/brokerClient.js');

function createConnection() {
  const connection = new EventEmitter();
  connection.createChannel = vi.fn().mockResolvedValue({ type: 'channel' });
  connection.createConfirmChannel = vi.fn().mockResolvedValue({ type: 'confirm-channel' });
  connection.close = vi.fn().mockResolvedValue(undefined);
  return connection;
}

describe('message broker client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reuses one connection for regular and confirm channels', async () => {
    const connection = createConnection();
    connect.mockResolvedValue(connection);
    const client = createBrokerClient({
      url: 'amqp://localhost',
      reconnectDelayMs: 1000,
      logger: { error: vi.fn(), warn: vi.fn() }
    });

    await expect(client.createChannel()).resolves.toEqual({ type: 'channel' });
    await expect(client.createConfirmChannel()).resolves.toEqual({
      type: 'confirm-channel'
    });

    expect(connect).toHaveBeenCalledTimes(1);
    expect(client.isConnected()).toBe(true);
    await client.close();
    expect(connection.close).toHaveBeenCalledTimes(1);
  });

  it('reports a disconnected state after the connection closes', async () => {
    vi.useFakeTimers();
    const connection = createConnection();
    connect.mockResolvedValue(connection);
    const logger = { error: vi.fn(), warn: vi.fn() };
    const client = createBrokerClient({
      url: 'amqp://localhost',
      reconnectDelayMs: 1000,
      logger
    });

    await client.connect();
    connection.emit('close');

    expect(client.isConnected()).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith('Message broker connection closed');

    await client.close();
    vi.useRealTimers();
  });

  it('closes a connection that resolves while shutdown is in progress', async () => {
    let resolveConnection;
    const connection = createConnection();
    connect.mockReturnValue(new Promise((resolve) => {
      resolveConnection = resolve;
    }));
    const client = createBrokerClient({
      url: 'amqp://localhost',
      reconnectDelayMs: 1000,
      logger: { error: vi.fn(), warn: vi.fn() }
    });

    const connecting = client.connect();
    const closing = client.close();
    resolveConnection(connection);

    await connecting;
    await closing;

    expect(connection.close).toHaveBeenCalledTimes(1);
    expect(client.isConnected()).toBe(false);
  });
});
