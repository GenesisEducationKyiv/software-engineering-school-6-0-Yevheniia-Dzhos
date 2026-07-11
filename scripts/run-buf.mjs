import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2];
const allowedModes = new Set(['lint', 'generate']);

if (!allowedModes.has(mode)) {
  console.error('Usage: node scripts/run-buf.mjs <lint|generate>');
  process.exit(1);
}

const bufBin = path.join(rootDir, 'node_modules', '@bufbuild', 'buf', 'bin', 'buf');
const cacheDir = path.join(rootDir, '.buf-cache');

fs.mkdirSync(cacheDir, { recursive: true });

const result = spawnSync(process.execPath, [bufBin, mode], {
  cwd: rootDir,
  env: {
    ...process.env,
    BUF_CACHE_DIR: cacheDir
  },
  stdio: 'inherit'
});

if (result.error) {
  console.error(`Failed to start buf: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
