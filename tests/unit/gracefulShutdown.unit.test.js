import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeHttpServer,
  registerGracefulShutdown
} from '../../src/utils/gracefulShutdown.js';

describe('graceful shutdown', () => {
  const originalExitCode = process.exitCode;
  const originalSigtermListeners = process.listeners('SIGTERM');
  const originalSigintListeners = process.listeners('SIGINT');

  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.listeners('SIGTERM')
      .filter((listener) => !originalSigtermListeners.includes(listener))
      .forEach((listener) => process.removeListener('SIGTERM', listener));
    process.listeners('SIGINT')
      .filter((listener) => !originalSigintListeners.includes(listener))
      .forEach((listener) => process.removeListener('SIGINT', listener));
    process.exitCode = originalExitCode;
  });

  it('runs shutdown only once', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const logger = { info: vi.fn(), error: vi.fn() };
    const shutdown = registerGracefulShutdown({
      logger,
      serviceName: 'test-service',
      close
    });

    await Promise.all([shutdown('SIGTERM'), shutdown('SIGINT')]);

    expect(close).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('closes a listening HTTP server', async () => {
    const server = new EventEmitter();
    server.listening = true;
    server.close = vi.fn((callback) => callback());

    await closeHttpServer(server);

    expect(server.close).toHaveBeenCalledTimes(1);
  });
});
