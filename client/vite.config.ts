import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// The local server the dev proxy talks to. The end-to-end tests run their own server on another port (e2e/).
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Makes the app installable on phones (PWA): a web app manifest with the icons,
    // and a service worker that keeps the app's own files, so it opens fast and even without internet.
    VitePWA({
      registerType: 'autoUpdate',      // a new version is used as soon as it is deployed
      injectRegister: 'script',        // a separate registerSW.js file, allowed by our Content-Security-Policy
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],
      manifest: {
        name: 'TripPlanner',
        short_name: 'TripPlanner',
        description: 'Plan a trip with your friends: destination, dates, stays and costs in one place.',
        lang: 'en',
        start_url: '/dashboard',
        scope: '/',
        display: 'standalone',
        background_color: '#f3f6f8',
        theme_color: '#ffffff',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Only the app's own files are kept offline. Trip data always comes live from the server.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/],
      },
    }),
  ],
  server: {
    // In development, send API and socket requests to the local server,
    // so the browser sees one origin and no CORS setup is needed.
    proxy: {
      '/api': apiTarget,
      '/socket.io': { target: apiTarget, ws: true },
    },
  },
})
