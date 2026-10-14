import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      RATE_LIMIT_ENABLED: 'false',
      JWT_SECRET: process.env.JWT_SECRET ?? 'test-only-secret-not-used-anywhere-else-0123456789',
    },
    // All API suites share one test database.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
