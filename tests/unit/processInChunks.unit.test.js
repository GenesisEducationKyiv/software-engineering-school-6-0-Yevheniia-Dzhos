import { describe, expect, it, vi } from 'vitest';
import { processInChunks } from '../../src/modules/releaseTracking/processInChunks.js';

describe('processInChunks', () => {
  it('processes items in bounded parallel chunks and preserves result order', async () => {
    const operation = vi.fn(async (value) => value * 2);

    const results = await processInChunks([1, 2, 3, 4, 5], 2, operation);

    expect(operation).toHaveBeenCalledTimes(5);
    expect(results.map((result) => result.value)).toEqual([2, 4, 6, 8, 10]);
  });

  it('keeps processing when one item fails', async () => {
    const results = await processInChunks([1, 2, 3], 2, async (value) => {
      if (value === 2) throw new Error('failed');
      return value;
    });

    expect(results.map((result) => result.status)).toEqual([
      'fulfilled',
      'rejected',
      'fulfilled'
    ]);
  });

  it('rejects invalid chunk sizes', async () => {
    await expect(processInChunks([1], 0, async (value) => value))
      .rejects.toThrow('chunkSize must be a positive integer');
  });
});
