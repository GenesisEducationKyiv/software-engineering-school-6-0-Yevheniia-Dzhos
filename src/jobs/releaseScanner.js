import { scanForNewReleases } from '../services/releaseScannerService.js';
import { logger } from '../utils/logger.js';

let scannerIntervalId = null;
let isRunning = false;

export function startReleaseScanner(intervalMs) {
  if (scannerIntervalId) {
    return scannerIntervalId;
  }

  scannerIntervalId = setInterval(async () => {
    if (isRunning) {
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

  return scannerIntervalId;
}
