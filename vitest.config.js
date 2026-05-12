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
    // Mostrar cada prueba individual
    reporter: 'verbose',
    // Variables de entorno para tests
    env: {
      NODE_ENV: 'test'
    }
  }
});
