import { defineConfig } from 'vitest/config';

process.env.NODE_ENV = 'test';

export default defineConfig({
  test: {
    globals: true,
    pool: 'threads',
    testTimeout: 15000,
    fileParallelism: false,
  },
});
