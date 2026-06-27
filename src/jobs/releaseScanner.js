import { scanForNewReleases } from '../services/releaseScannerService.js';
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
      console.error('Scheduled scanner failed:', error.message);
    } finally {
      isRunning = false;
    }
  }, intervalMs);

  return scannerIntervalId;
}