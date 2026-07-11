import { scanForNewReleases } from './releaseScannerService.js';
import { logger } from '@notifier/shared/modules/observability/index.js';

let intervalId;
let isRunning = false;

async function runReleaseScan() {
  if (isRunning) {
    logger.warn('Scheduled scanner skipped because the previous run is still active');
    return;
  }

  isRunning = true;

  try {
    await scanForNewReleases();
  } catch (error) {
    logger.error('Scheduled scanner failed', { error });
  } finally {
    isRunning = false;
  }
}

export function startReleaseScanner(intervalMs) {
  if (intervalId) return intervalId;

  void runReleaseScan();
  intervalId = setInterval(runReleaseScan, intervalMs);

  return intervalId;
}

export function stopReleaseScanner() {
  if (!intervalId) return;

  clearInterval(intervalId);
  intervalId = undefined;
}
