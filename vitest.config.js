import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.config.{js,jsx}',
        '**/main.jsx',
        'demo-data/',
        'scripts/',
      ],
      // Critical path coverage thresholds
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
        perFile: true,
      },
      // Only track critical files
      include: [
        'src/utils/**/*.jsx',
        'src/App.jsx',
      ],
    },
    // Split test runs for better performance
    testTimeout: 10000,
    hookTimeout: 10000,
    isolate: true,
    // Smart file matching for parallel runs
    include: ['tests/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    // Allow running tests by pattern
    allowOnly: process.env.CI ? false : true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test': path.resolve(__dirname, './tests'),
    },
  },
})
