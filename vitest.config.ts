import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    include: ['**/*.spec.ts', '**/*.spec.vue'],
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, 'app'),
      '@': resolve(__dirname, 'app'),
      '#app': resolve(__dirname, 'node_modules/nuxt/dist/app'),
    },
  },
})
