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
    // Default: BFF port 3001. The explicit laboratory launcher overrides
    // only this server-side target; no backend credentials enter the bundle.
    cors: process.env.VITE_TITVO_LAB === 'true' ? { origin: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ } : undefined,
    proxy: {
      '/api': {
        target: process.env.TITVO_DEV_API_URL ?? 'http://localhost:3001',
        changeOrigin: process.env.VITE_TITVO_LAB !== 'true'
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
