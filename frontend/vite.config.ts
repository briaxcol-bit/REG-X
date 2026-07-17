import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // PWA instalable como app de escritorio.
      // 'prompt': la versión nueva NO recarga la página sola (un POS no puede
      // reiniciarse en plena venta). main.tsx decide: si no hay carritos con
      // ítems actualiza de inmediato; si los hay, muestra un aviso con botón.
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'REG-X ERP/POS',
        short_name: 'REG-X',
        description: 'Sistema ERP/POS SaaS Enterprise',
        theme_color: '#F20D18',
        background_color: '#111827',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        categories: ['business', 'productivity'],
        shortcuts: [
          { name: 'POS', short_name: 'POS', url: '/pos', icons: [{ src: '/pwa-64x64.png', sizes: '64x64' }] },
          { name: 'Dashboard', short_name: 'Panel', url: '/dashboard', icons: [{ src: '/pwa-64x64.png', sizes: '64x64' }] },
        ],
        prefer_related_applications: false,
      },
      workbox: {
        // .wasm incluido para precachear el motor del escáner de códigos (zxing-wasm)
        // cuando Vite lo empaqueta al origen. Así el escáner funciona offline.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm}'],
        // El .wasm del escáner ronda 1–2 MB; subimos el límite de precache (default 2 MiB).
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Si zxing-wasm carga su .wasm desde CDN (jsDelivr/unpkg/fastly),
            // lo guardamos tras el primer uso online para que luego funcione offline.
            urlPattern: /^https:\/\/(?:cdn\.jsdelivr\.net|fastly\.jsdelivr\.net|unpkg\.com)\/npm\/zxing-wasm.*\.wasm$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'zxing-wasm-cache',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              // 3 días: NetworkFirst siempre prefiere la red; el cache solo se usa
              // como respaldo offline (catálogo, categorías, etc.)
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 3 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /\/api\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 2 },
              networkTimeoutSeconds: 8,
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
        // skipWaiting/clientsClaim desactivados: el SW nuevo espera a que
        // main.tsx lo active (updateSW) — evita recargas a mitad de venta.
        skipWaiting: false,
        clientsClaim: false,
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@store': path.resolve(__dirname, './src/store'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['framer-motion', 'lucide-react'],
          'vendor-forms': ['react-hook-form', 'zod', '@hookform/resolvers'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-charts': ['recharts'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@supabase/supabase-js'],
  },
})
