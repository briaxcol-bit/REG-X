import path from 'path'
import { defineConfig } from 'vitest/config'

// Config de tests — alias idénticos a vite.config.ts para que los imports
// @lib/@store/@modules resuelvan igual que en la app.
export default defineConfig({
  resolve: {
    alias: {
      '@':        path.resolve(__dirname, './src'),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@shared':  path.resolve(__dirname, './src/shared'),
      '@store':   path.resolve(__dirname, './src/store'),
      '@lib':     path.resolve(__dirname, './src/lib'),
      '@hooks':   path.resolve(__dirname, './src/hooks'),
      '@types':   path.resolve(__dirname, './src/types'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
