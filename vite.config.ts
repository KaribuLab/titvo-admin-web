import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    // In production, CloudFront routes /api/* to the BFF's API Gateway
    // origin so the browser sees one same-origin surface (see design.md
    // and bff-auth-routing-decision). This proxy reproduces that locally:
    // matches the BFF's default local PORT (see .env.local.example there
    // — change both together if you run the BFF on a different port).
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // jsdom's default document origin is opaque ("about:blank"), which makes
    // `window.localStorage` throw/be unavailable — needed by the new
    // dark-mode ThemeProvider's persistence (see src/lib/theme.ts).
    environmentOptions: {
      jsdom: {
        url: 'http://localhost:3000'
      }
    },
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.spec.tsx', 'test/**/*.spec.ts']
  }
})
