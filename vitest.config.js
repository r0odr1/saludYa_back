import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    /** Ejecutar en secuencia (no en paralelo) porque comparten DB */
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true }
    },
    // Tiempo límite por prueba (ms)
    testTimeout: 15000,
    hookTimeout: 15000,
    // Variables de entorno para tests
    env: {
      NODE_ENV: 'test'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'controllers/**/*.js',
        'middleware/**/*.js',
        'models/**/*.js',
        'utils/**/*.js',
        'routes/**/*.js'
      ],
      exclude: [
        'seeds/**',
        'docs/**',
        'tests/**',
        'node_modules/**',
        'server.js',
        'config/**'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    }
  }
});
