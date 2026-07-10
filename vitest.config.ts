import { defineConfig } from 'vitest/config'

/**
 * Dedicated Vitest config so unit tests don't load the full app Vite config
 * (TanStack Start plugins are only needed for dev/build). Most tests use the
 * default Node environment; component tests opt into jsdom per file.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
