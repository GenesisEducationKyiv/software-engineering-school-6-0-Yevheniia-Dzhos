import { afterEach, describe, expect, it, vi } from 'vitest';

const originalFetch = global.fetch;
const originalTimeout = process.env.GITHUB_REQUEST_TIMEOUT_MS;

describe('GitHub client', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalTimeout === undefined) {
      delete process.env.GITHUB_REQUEST_TIMEOUT_MS;
    } else {
      process.env.GITHUB_REQUEST_TIMEOUT_MS = originalTimeout;
    }
    vi.resetModules();
  });

  it('passes a timeout signal to GitHub requests', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers()
    });
    const { githubGet } = await import('../../src/modules/releaseTracking/githubClient.js');

    await githubGet('/repos/owner/repo');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/repos/owner/repo'),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('returns a 502 application error when a GitHub request times out', async () => {
    process.env.GITHUB_REQUEST_TIMEOUT_MS = '1';
    global.fetch = vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason));
    }));
    const { githubGet } = await import('../../src/modules/releaseTracking/githubClient.js');

    await expect(githubGet('/repos/owner/repo')).rejects.toMatchObject({
      status: 502,
      message: 'GitHub API unavailable'
    });
  });
});

