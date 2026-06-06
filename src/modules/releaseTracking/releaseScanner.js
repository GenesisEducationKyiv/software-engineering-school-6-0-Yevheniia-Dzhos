import { scanForNewReleases } from './releaseScannerService.js';
import { logger } from '../observability/index.js';

export { scanForNewReleases };

let intervalId;
let isRunning = false;

export function startReleaseScanner(intervalMs) {
  if (intervalId) return intervalId;

  intervalId = setInterval(async () => {
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
  }, intervalMs);

  return intervalId;
}
