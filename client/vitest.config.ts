import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: { EXPO_PUBLIC_API_URL: 'http://api.test' },
    include: ['src/**/*.test.ts'],
  },
});
