import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeAll,
  closeHttpServer,
  registerGracefulShutdown
} from '@notifier/shared/utils/gracefulShutdown.js';

describe('graceful shutdown', () => {
  const originalExitCode = process.exitCode;
  const originalSigtermListeners = process.listeners('SIGTERM');
  const originalSigintListeners = process.listeners('SIGINT');

  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('force-exits if close() hangs past the timeout', async () => {
    vi.useFakeTimers();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined);
    const close = vi.fn(() => new Promise(() => {}));
    const logger = { info: vi.fn(), error: vi.fn() };

    const shutdown = registerGracefulShutdown({
      logger,
      serviceName: 'test-service',
      close,
      timeoutMs: 50
    });

    void shutdown('SIGTERM');
    await vi.advanceTimersByTimeAsync(50);

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith(
      'Graceful shutdown timed out',
      expect.objectContaining({ serviceName: 'test-service', signal: 'SIGTERM', timeoutMs: 50 })
    );
  });

  it('does not fire the timeout once close() resolves in time', async () => {
    vi.useFakeTimers();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const logger = { info: vi.fn(), error: vi.fn() };

    const shutdown = registerGracefulShutdown({
      logger,
      serviceName: 'test-service',
      close,
      timeoutMs: 50
    });

    await shutdown('SIGTERM');
    await vi.advanceTimersByTimeAsync(50);

    expect(exitSpy).not.toHaveBeenCalled();
  });
});

describe('closeAll', () => {
  it('runs every step even when an earlier one throws, then reports failure', async () => {
    const logger = { error: vi.fn() };
    const first = vi.fn().mockRejectedValue(new Error('boom'));
    const second = vi.fn().mockResolvedValue(undefined);

    await expect(closeAll([
      ['first', first],
      ['second', second]
    ], logger)).rejects.toThrow('1 shutdown step(s) failed');

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to close first during shutdown',
      expect.objectContaining({ error: expect.any(Error) })
    );
  });

  it('resolves without throwing when every step succeeds', async () => {
    const logger = { error: vi.fn() };
    const step = vi.fn().mockResolvedValue(undefined);

    await expect(closeAll([['step', step]], logger)).resolves.toBeUndefined();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
