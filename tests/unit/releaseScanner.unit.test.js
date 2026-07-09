import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/releaseTracking/releaseScannerService.js', () => ({
  scanForNewReleases: vi.fn()
}));
vi.mock('../../src/modules/observability/index.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn()
  }
}));

const scannerService = await import('../../src/modules/releaseTracking/releaseScannerService.js');
const { logger } = await import('../../src/modules/observability/index.js');
const {
  startReleaseScanner,
  stopReleaseScanner
} = await import('../../src/modules/releaseTracking/releaseScanner.js');

describe('release scanner scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    stopReleaseScanner();
  });

  afterEach(() => {
    stopReleaseScanner();
    vi.useRealTimers();
  });

  it('starts without waiting for the initial scan to complete', async () => {
    let finishScan;
    scannerService.scanForNewReleases.mockReturnValue(new Promise((resolve) => {
      finishScan = resolve;
    }));

    const intervalId = startReleaseScanner(1000);

    expect(intervalId).toBeDefined();
    expect(scannerService.scanForNewReleases).toHaveBeenCalledTimes(1);

    finishScan();
    await Promise.resolve();
  });

  it('prevents an interval scan from overlapping the initial scan', async () => {
    let finishScan;
    scannerService.scanForNewReleases.mockReturnValue(new Promise((resolve) => {
      finishScan = resolve;
    }));

    startReleaseScanner(1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(scannerService.scanForNewReleases).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'Scheduled scanner skipped because the previous run is still active'
    );

    finishScan();
    await Promise.resolve();
  });


  it('logs scan failures without rejecting startup', async () => {
    const error = new Error('scan failed');
    scannerService.scanForNewReleases.mockRejectedValue(error);

    expect(() => startReleaseScanner(1000)).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    expect(logger.error).toHaveBeenCalledWith('Scheduled scanner failed', { error });
  });
});
