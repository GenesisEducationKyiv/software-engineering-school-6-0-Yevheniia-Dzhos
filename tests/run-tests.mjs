import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { applyTestEnv, buildTestEnv } from './helpers/testEnv.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = path.join(rootDir, 'tests');
const e2eDir = path.join(testsDir, 'e2e');
const mode = process.argv[2] || 'all';
const allowedModes = new Set(['all', 'unit', 'integration', 'e2e']);

if (!allowedModes.has(mode)) {
  console.error(`Unknown test mode "${mode}". Use one of: ${[...allowedModes].join(', ')}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || rootDir,
    env: { ...process.env, ...(options.env || {}) },
    stdio: 'inherit',
    shell: true
  });

  if (result.status !== 0) {
    if (options.allowFailure) return result;
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function rootDependencyPath(relativePath) {
  return path.join(rootDir, 'node_modules', ...relativePath.split('/'));
}

function ensureRootDependencies() {
  if (fs.existsSync(rootDependencyPath('vitest/vitest.mjs'))) return;

  console.log('Installing root Node dependencies...');
  run('npm', ['ci']);
}

function ensureE2eDependencies() {
  const playwrightCli = path.join(e2eDir, 'node_modules', '@playwright', 'test');

  if (!fs.existsSync(playwrightCli)) {
    console.log('Installing Playwright test dependencies...');
    const installCommand = fs.existsSync(path.join(e2eDir, 'package-lock.json')) ? 'ci' : 'install';
    run('npm', ['--prefix', 'tests/e2e', installCommand]);
  }

  console.log('Ensuring Playwright Chromium is installed...');
  run('npm', ['exec', '--', 'playwright', 'install', 'chromium'], { cwd: e2eDir });
}

async function waitForPostgres() {
  const pg = await import('pg');
  const { DATABASE_URL: connectionString } = buildTestEnv();
  const deadline = Date.now() + 30000;
  let lastError;

  while (Date.now() < deadline) {
    const client = new pg.Client({ connectionString });

    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return;
    } catch (error) {
      lastError = error;
      try {
        await client.end();
      } catch {
        // Ignore failed cleanup while the container is still starting.
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw lastError || new Error('Timed out waiting for PostgreSQL');
}

async function runUnit() {
  ensureRootDependencies();
  run('npx', ['vitest', 'run', '--config', 'tests/vitest.unit.config.mjs']);
}

async function withDockerDependencies(callback) {
  const composeArgs = [
    'compose',
    '-p',
    'github-release-notifier-tests',
    '-f',
    'tests/docker-compose.integration.yml'
  ];

  try {
    run('docker', [...composeArgs, 'up', '-d']);
    await waitForPostgres();
    await callback();
  } finally {
    run('docker', [...composeArgs, 'down', '-v'], { allowFailure: true });
  }
}

async function runIntegration() {
  ensureRootDependencies();
  const {
    close,
    createGithubStubServer,
    listen
  } = await import('./helpers/githubStubServer.mjs');
  let githubServer;

  try {
    await withDockerDependencies(async () => {
    githubServer = createGithubStubServer();
    const githubPort = await listen(githubServer);
    const testEnv = applyTestEnv({
      GITHUB_API_URL: `http://127.0.0.1:${githubPort}`
    });

    const migrationModule = await import('../src/db/migrate.js');
    const dbModule = await import('../src/db/client.js');
    await migrationModule.runMigrations();
    await dbModule.pool.end();

    run('npx', ['vitest', 'run', '--config', 'tests/vitest.integration.config.mjs'], {
      env: testEnv
    });
    });
  } finally {
    await close(githubServer);
  }
}

async function runE2e() {
  ensureRootDependencies();
  ensureE2eDependencies();

  await withDockerDependencies(async () => {
    run('npm', ['exec', '--', 'playwright', 'test', '--config=playwright.config.cjs'], {
      cwd: e2eDir,
      env: buildTestEnv({ APP_BASE_URL: 'http://127.0.0.1:3310' })
    });
  });
}

try {
  if (mode === 'unit') await runUnit();
  if (mode === 'integration') await runIntegration();
  if (mode === 'e2e') await runE2e();

  if (mode === 'all') {
    await runUnit();
    await runIntegration();
    await runE2e();
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
