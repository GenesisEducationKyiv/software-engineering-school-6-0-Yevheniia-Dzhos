export function registerGracefulShutdown({
  logger,
  serviceName,
  close
}) {
  let shuttingDown;

  async function shutdown(signal) {
    if (shuttingDown) return shuttingDown;

    logger.info('Graceful shutdown started', { serviceName, signal });
    shuttingDown = close()
      .then(() => {
        logger.info('Graceful shutdown completed', { serviceName, signal });
      })
      .catch((error) => {
        logger.error('Graceful shutdown failed', { serviceName, signal, error });
        process.exitCode = 1;
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
