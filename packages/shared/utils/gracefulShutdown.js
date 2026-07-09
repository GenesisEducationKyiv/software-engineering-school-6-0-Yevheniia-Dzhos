export function registerGracefulShutdown({
  logger,
  serviceName,
  close,
  timeoutMs = 10000
}) {
  let shuttingDown;

  async function shutdown(signal) {
    if (shuttingDown) return shuttingDown;

    logger.info('Graceful shutdown started', { serviceName, signal });

    const timeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out', { serviceName, signal, timeoutMs });
      process.exit(1);
    }, timeoutMs);

    shuttingDown = close()
      .then(() => {
        logger.info('Graceful shutdown completed', { serviceName, signal });
      })
      .catch((error) => {
        logger.error('Graceful shutdown failed', { serviceName, signal, error });
        process.exitCode = 1;
      })
      .finally(() => {
        clearTimeout(timeout);
      });

    return shuttingDown;
  }

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  return shutdown;
}

export async function closeHttpServer(server) {
  if (!server?.listening) return;

  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

export async function closeAll(steps, logger) {
  const errors = [];

  for (const [label, fn] of steps) {
    try {
      await fn();
    } catch (error) {
      logger.error(`Failed to close ${label} during shutdown`, { error });
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new Error(`${errors.length} shutdown step(s) failed`);
  }
}
