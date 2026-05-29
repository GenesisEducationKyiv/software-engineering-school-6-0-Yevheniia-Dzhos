import { scanForNewReleases } from '../services/releaseScannerService.js';
import { logger } from '../utils/logger.js';

export { scanForNewReleases };

export function startReleaseScanner(intervalMs) {
  setInterval(() => {
    scanForNewReleases().catch((error) => {
      logger.error('Scheduled scanner failed', { error });
    });
  }, intervalMs);
}