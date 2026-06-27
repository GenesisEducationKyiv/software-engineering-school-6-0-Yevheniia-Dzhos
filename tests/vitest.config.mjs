import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.unit.test.js', 'tests/integration/**/*.integration.test.js'],
    globals: false,
    hookTimeout: 30000,
    testTimeout: 30000
  }
});
