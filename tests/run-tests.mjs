import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = path.join(rootDir, 'tests');
const mode = process.argv[2] || 'all';
const allowedModes = new Set(['all', 'unit', 'integration', 'e2e', 'e2e:install']);

if (!allowedModes.has(mode)) {
  console.error(`Unknown test mode "${mode}". Use one of: ${[...allowedModes].join(', ')}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || rootDir,
    env: { ...process.env, ...(options.env || {}) },
    stdio: 'inherit'
  });

  if (result.error) {
    if (options.allowFailure) return result;
    throw new Error(`Failed to start ${command}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    if (options.allowFailure) return result;
    const reason = result.signal
      ? `signal ${result.signal}`
      : `exit code ${result.status}`;
    throw new Error(`${command} ${args.join(' ')} failed with ${reason}`);
  }

  return result;
}

function rootDependencyPath(relativePath) {
  return path.join(rootDir, 'node_modules', ...relativePath.split('/'));
}

function testsDependencyPath(relativePath) {
  return path.join(testsDir, 'node_modules', ...relativePath.split('/'));
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function ensureRootDependencies() {
  if (fs.existsSync(rootDependencyPath('vitest/vitest.mjs'))) return;

  console.log('Installing root Node dependencies...');
  run(npmCommand(), ['ci']);
}

function ensureE2eDependencies() {
  const playwrightCli = testsDependencyPath('@playwright/test/cli.js');

  if (fs.existsSync(playwrightCli)) return;

  console.log('Installing Playwright test dependencies...');
  const installCommand = fs.existsSync(path.join(testsDir, 'package-lock.json')) ? 'ci' : 'install';
  run(npmCommand(), ['--prefix', 'tests', installCommand]);
}

async function waitForPostgres() {
  const pg = await import('pg');
  const connectionString = 'postgres://postgres:postgres@localhost:55432/releases_test';
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
      } catch (cleanupError) {
        void cleanupError;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw lastError || new Error('Timed out waiting for PostgreSQL');
}

async function runUnit() {
  ensureRootDependencies();
  run(process.execPath, [rootDependencyPath('vitest/vitest.mjs'), 'run', '--config', 'tests/vitest.unit.config.mjs'], {
    env: {
      DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/releases_test'
    }
  });
}

async function waitForRabbitMq() {
  const amqp = await import('amqplib');
  const url = 'amqp://guest:guest@localhost:55672';
  const deadline = Date.now() + 30000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const connection = await amqp.default.connect(url);
      await connection.close();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw lastError || new Error('Timed out waiting for RabbitMQ');
}

async function runIntegration() {
  ensureRootDependencies();

  const composeArgs = [
    'compose',
    '-p',
    'github-release-notifier-tests',
    '-f',
    'tests/docker-compose.integration.yml'
  ];

  try {
    run('docker', [...composeArgs, 'up', '-d']);
    await Promise.all([waitForPostgres(), waitForRabbitMq()]);
    run(process.execPath, [
      rootDependencyPath('vitest/vitest.mjs'),
      'run',
      '--config',
      'tests/vitest.integration.config.mjs'
    ], {
      env: {
        DATABASE_URL: 'postgres://postgres:postgres@localhost:55432/releases_test',
        RABBITMQ_URL: 'amqp://guest:guest@localhost:55672',
        SMTP_HOST: 'localhost',
        SMTP_PORT: '11025',
        APP_BASE_URL: 'http://localhost:3000'
      }
    });
  } finally {
    run('docker', [...composeArgs, 'down', '-v'], { allowFailure: true });
  }
}

async function runE2e() {
  ensureRootDependencies();
  ensureE2eDependencies();
  run(process.execPath, [
    testsDependencyPath('@playwright/test/cli.js'),
    'test',
    '--config=playwright.config.cjs'
  ], { cwd: testsDir });
}

async function installE2eBrowser() {
  ensureE2eDependencies();
  run(process.execPath, [
    testsDependencyPath('@playwright/test/cli.js'),
    'install',
    'chromium'
  ], { cwd: testsDir });
}

try {
  if (mode === 'unit') await runUnit();
  if (mode === 'integration') await runIntegration();
  if (mode === 'e2e') await runE2e();
  if (mode === 'e2e:install') await installE2eBrowser();

  if (mode === 'all') {
    await runUnit();
    await runIntegration();
    await runE2e();
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
