import { describe, expect, it } from 'vitest';
import { getRequestRoute } from '../../src/utils/requestRoute.js';

function createRequest(originalUrl, routePath, baseUrl = '') {
  return {
    originalUrl,
    baseUrl,
    route: routePath ? { path: routePath } : undefined
  };
}

describe('request route labels', () => {
  it('uses route templates instead of raw token values', () => {
    const route = getRequestRoute(
      createRequest('/api/confirm/secret-token-123?source=email', '/confirm/:token')
    );

    expect(route).toBe('/api/confirm/:token');
    expect(route).not.toContain('secret-token-123');
  });

  it('returns unknown when Express did not match a route', () => {
    expect(getRequestRoute(createRequest('/random/path'))).toBe('unknown');
  });
});
