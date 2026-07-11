import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/client.js';
import {
  startReleaseScanner,
  stopReleaseScanner
} from './modules/releaseTracking/index.js';
import { closeNotificationPublisher } from './modules/notifications/index.js';
import {
  closeSagaReplyConsumer,
  startSagaRecovery,
  startSagaReplyConsumer
} from './modules/sagas/index.js';
import { logger } from '@notifier/shared/modules/observability/index.js';
import {
  closeAll,
  closeHttpServer,
  registerGracefulShutdown
} from '@notifier/shared/utils/gracefulShutdown.js';

const app = createApp();

startSagaReplyConsumer();
startSagaRecovery();

const server = app.listen(env.port, () => {
  logger.info('Server started', { port: env.port });
  startReleaseScanner(env.scanIntervalMs);
});

registerGracefulShutdown({
  logger,
  serviceName: 'github-release-notifier',
  close: () => closeAll([
    ['release scanner', () => stopReleaseScanner()],
    ['http server', () => closeHttpServer(server)],
    ['saga reply consumer', () => closeSagaReplyConsumer()],
    ['notification publisher', () => closeNotificationPublisher()],
    ['database pool', () => pool.end()]
  ], logger)
});
