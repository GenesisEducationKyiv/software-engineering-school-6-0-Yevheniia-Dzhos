import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/client.js';
import {
  startReleaseScanner,
  stopReleaseScanner
} from './modules/releaseTracking/releaseScanner.js';
import { closeNotificationPublisher } from './modules/notifications/index.js';
import {
  closeSagaReplyConsumer,
  startSagaReplyConsumer
} from './modules/sagas/index.js';
import { logger } from './modules/observability/index.js';
import {
  closeHttpServer,
  registerGracefulShutdown
} from './utils/gracefulShutdown.js';

const app = createApp();

await startSagaReplyConsumer();

const server = app.listen(env.port, () => {
  logger.info('Server started', { port: env.port });
  startReleaseScanner(env.scanIntervalMs);
});

registerGracefulShutdown({
  logger,
  serviceName: 'github-release-notifier',
  close: async () => {
    stopReleaseScanner();
    await closeHttpServer(server);
    await closeSagaReplyConsumer();
    await closeNotificationPublisher();
    await pool.end();
  }
});
