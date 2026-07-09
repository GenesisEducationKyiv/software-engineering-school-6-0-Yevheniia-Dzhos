import { createApp } from './app.js';
import { env } from './config.js';
import { logger } from './observability.js';

const app = createApp();

app.listen(env.port, () => {
  logger.info('Notification service started', { port: env.port });
});
