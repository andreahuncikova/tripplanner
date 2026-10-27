import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    env: {
      // config.ts refuses to start without a long secret; tests use this fake one (never a real secret)
      JWT_SECRET: 'test-only-secret-that-is-at-least-32-characters-long',
    },
  },
});
