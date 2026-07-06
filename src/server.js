import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { startReleaseScanner } from './jobs/releaseScanner.js';
import { scanForNewReleases } from './services/releaseScannerService.js';
import { logger } from './utils/logger.js';

const app = createApp();

async function bootstrap() {
  try {
    await runMigrations();
    await scanForNewReleases();
    startReleaseScanner(env.scanIntervalMs);

    app.listen(env.port, () => {
      logger.info('Server started', { port: env.port });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    await pool.end();
    process.exit(1);
  }
}

bootstrap();
