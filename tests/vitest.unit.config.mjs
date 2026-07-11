import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.unit.test.js'],
    globals: false,
    restoreMocks: true,
    clearMocks: true
  }
});
