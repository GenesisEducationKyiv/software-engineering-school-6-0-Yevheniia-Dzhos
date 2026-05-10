import { scanForNewReleases } from '../services/releaseScannerService.js';

export { scanForNewReleases };

export function startReleaseScanner(intervalMs) {
  setInterval(() => {
    scanForNewReleases().catch((error) => {
      console.error('Scheduled scanner failed:', error.message);
    });
  }, intervalMs);
}