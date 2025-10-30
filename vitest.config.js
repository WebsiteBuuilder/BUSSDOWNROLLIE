import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/**',
        '*.config.js',
        'scripts/**'
      ],
      include: [
        'src/roulette/**'
      ]
    },
    testTimeout: 30000, // 30 second timeout for integration tests
    hookTimeout: 10000
  }
});

