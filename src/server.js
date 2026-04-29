import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { startReleaseScanner, scanForNewReleases } from './jobs/releaseScanner.js';

const app = createApp();

async function bootstrap() {
  try {
    await runMigrations();
    await scanForNewReleases();
    startReleaseScanner(env.scanIntervalMs);

    app.listen(env.port, () => {
      console.log(`Server running on port ${env.port}`);
    });
  } catch (error) {
    console.error('Failed to start:', error);
    await pool.end();
    process.exit(1);
  }
}

bootstrap();
