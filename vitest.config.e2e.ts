import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    env: { NODE_ENV: 'test' },
    // All e2e files share one database, so run them one at a time.
    fileParallelism: false,
  },
});
