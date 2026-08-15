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

// Same reasoning as DEFAULT_ACCOUNT_URL above, for the info site's privacy
// notice link in the landing page's Privacy section.
const DEFAULT_INFO_URL = 'https://info.clockflux.app'

/**
 * Substitutes %VITE_ACCOUNT_URL% and %VITE_INFO_URL% in index.html.
 *
 * index.html links to the account and info sites, but it's plain markup — no
 * module runs in the #landing block at all — so it can't read
 * import.meta.env the way App.tsx does. Hardcoding the production URLs there
 * meant the links jumped to the live sites from a dev server.
 *
 * Vite's own %ENV% replacement would leave the placeholder in the output
 * verbatim when the variable is unset, shipping a broken href; this applies
 * the same fallback App.tsx uses instead.
 */
function crossAppUrlsInHtml(mode) {
  const { VITE_ACCOUNT_URL, VITE_INFO_URL } = loadEnv(mode, rootDir, 'VITE_')
  const accountUrl = (VITE_ACCOUNT_URL || DEFAULT_ACCOUNT_URL).replace(/\/$/, '')
  const infoUrl = (VITE_INFO_URL || DEFAULT_INFO_URL).replace(/\/$/, '')

  return {
    name: 'clockflux-cross-app-urls-in-html',
    transformIndexHtml(html) {
      return html
        .replaceAll('%VITE_ACCOUNT_URL%', accountUrl)
        .replaceAll('%VITE_INFO_URL%', infoUrl)
    },
  }
}

export default defineConfig(({ mode }) => ({
  build: {
    // Hidden source maps: emitted for debugging, but with no
    // //# sourceMappingURL comment, so a browser only loads them if someone
    // deliberately points a devtool at them. Without any map at all, a
    // production crash report is a minified stack that says nothing — and the
    // error reporter has no SDK wired in yet, so the user's own console is
    // currently the only place a crash is visible.
    sourcemap: 'hidden',
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
      },
    },
  },
  plugins: [
    crossAppUrlsInHtml(mode),
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
        navigateFallbackDenylist: [/^\/robots\.txt$/, /^\/sitemap\.xml$/]
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
