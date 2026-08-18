/// <reference types="vitest" />
// vitest v4：必须从 vitest/config 导入 defineConfig 才能识别 test 配置块
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['maplibre-gl']
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/__tests__/**',
        'src/**/test/**',
        'src/main.tsx',
        'src/App.css',
        'src/index.css',
      ],
      thresholds: {
        statements: 50,
        branches: 45,
        functions: 45,
        lines: 50,
      },
    },
  },
})
