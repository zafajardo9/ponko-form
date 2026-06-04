import { defineConfig } from 'vitest/config'

/**
 * Dedicated Vitest config so unit tests don't load the full app Vite config
 * (the Neon plugin and TanStack Start plugin are only needed for dev/build).
 * The flow-engine library is pure TypeScript, so the default node environment
 * is sufficient.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
