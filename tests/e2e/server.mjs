import {
  close,
  createGithubStubServer,
  listen
} from '../helpers/githubStubServer.mjs';
import { applyTestEnv } from '../helpers/testEnv.mjs';

const port = Number(process.env.E2E_PORT || '3310');
applyTestEnv({
  PORT: String(port),
  APP_BASE_URL: `http://127.0.0.1:${port}`
});

const githubServer = createGithubStubServer();
const githubPort = await listen(githubServer);
process.env.GITHUB_API_URL = `http://127.0.0.1:${githubPort}`;

const { createApp } = await import('../../src/app.js');
const { pool } = await import('../../src/db/client.js');
const { runMigrations } = await import('../../src/db/migrate.js');

await runMigrations();

const appServer = await new Promise((resolve) => {
  const server = createApp().listen(port, '127.0.0.1', () => {
    console.log(`E2E app running on http://127.0.0.1:${port}`);
    resolve(server);
  });
});

async function shutdown() {
  await close(appServer);
  await close(githubServer);
  await pool.end();
}

process.on('SIGTERM', () => {
  shutdown().finally(() => process.exit(0));
});

process.on('SIGINT', () => {
  shutdown().finally(() => process.exit(0));
});
