import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const sharedAlias = {
  '@shared': resolve(__dirname, 'src/shared'),
  '@main': resolve(__dirname, 'src/main'),
  '@': resolve(__dirname, 'src/renderer/src'),
}

export default defineConfig({
  plugins: [react()],
  resolve: { alias: sharedAlias },
  test: {
    globals: false,
    setupFiles: ['./tests/vitest.setup.ts'],
    include: [
      'tests/unit/**/*.spec.{ts,tsx}',
      'tests/integration/**/*.spec.{ts,tsx}',
    ],
    exclude: ['tests/e2e/**', 'node_modules/**', 'out/**', 'dist/**'],
    environment: 'node',
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/main/**', 'src/shared/**', 'src/renderer/src/**'],
      exclude: ['src/renderer/src/main.tsx', '**/*.d.ts'],
    },
  },
})
