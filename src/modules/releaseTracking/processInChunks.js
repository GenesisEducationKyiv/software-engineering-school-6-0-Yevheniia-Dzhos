export async function processInChunks(items, chunkSize, operation) {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new Error('chunkSize must be a positive integer');
  }

  const results = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    const chunk = items.slice(index, index + chunkSize);
    const chunkResults = await Promise.allSettled(chunk.map(operation));
    results.push(...chunkResults);
  }

  return results;
}
