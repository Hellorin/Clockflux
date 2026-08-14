import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

// Kept in step with src/App.tsx's ACCOUNT_URL by a test — see
// src/test/indexHtml.test.ts. Both need the same default because the
// account site is linked from static HTML *and* from Settings.
const DEFAULT_ACCOUNT_URL = 'https://account.clockflux.app'

/**
 * Substitutes %VITE_ACCOUNT_URL% in the static HTML entries.
 *
 * index.html and about/index.html link to the account site, but they're
 * plain markup — no module runs in about/index.html at all — so they can't
 * read import.meta.env the way App.tsx does. Hardcoding the production URL
 * there meant the link jumped to the live site from a dev server.
 *
 * Vite's own %ENV% replacement would leave the placeholder in the output
 * verbatim when the variable is unset, shipping a broken href; this applies
 * the same fallback App.tsx uses instead.
 */
function accountUrlInHtml(mode) {
  const { VITE_ACCOUNT_URL } = loadEnv(mode, rootDir, 'VITE_')
  const url = (VITE_ACCOUNT_URL || DEFAULT_ACCOUNT_URL).replace(/\/$/, '')

  return {
    name: 'clockflux-account-url-in-html',
    transformIndexHtml(html) {
      return html.replaceAll('%VITE_ACCOUNT_URL%', url)
    },
  }
}

export default defineConfig(({ mode }) => ({
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        about: resolve(rootDir, 'about/index.html'),
      },
    },
  },
  plugins: [
    accountUrlInHtml(mode),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Clockflux',
        short_name: 'Clockflux',
        description: 'A free, offline-first work hours tracker. Check in and out with one tap, track your holiday allowance, and monitor your work/life balance — all stored locally in your browser.',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Without this the service worker answers navigations to these paths
        // with the SPA shell instead of the real files.
        navigateFallbackDenylist: [/^\/robots\.txt$/, /^\/sitemap\.xml$/, /^\/about\//]
      }
    })
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: ['src/main.{jsx,tsx}', 'src/**/*.test.{js,jsx,ts,tsx}']
    }
  }
}))
