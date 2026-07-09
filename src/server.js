import { createApp } from './app.js';
import { env } from './config/env.js';
import { startReleaseScanner } from './modules/releaseTracking/releaseScanner.js';
import { logger } from './modules/observability/index.js';

const app = createApp();

app.listen(env.port, () => {
  logger.info('Server started', { port: env.port });
  startReleaseScanner(env.scanIntervalMs);
});
