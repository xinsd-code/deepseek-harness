import { defineConfig } from 'vitest/config'

// Standalone test config for the out-of-tree plugin. The harness's root vitest
// config is scoped to packages/apps/examples, so the plugin carries its own.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.{ts,tsx}'],
  },
})
