// vite.config.ts
import { defineConfig } from "file:///D:/proyectos_personales/REG-X/node_modules/vite/dist/node/index.js";
import react from "file:///D:/proyectos_personales/REG-X/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///D:/proyectos_personales/REG-X/node_modules/vite-plugin-pwa/dist/index.js";
import path from "path";
var __vite_injected_original_dirname = "D:\\proyectos_personales\\REG-X\\frontend";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    VitePWA({
      // PWA instalable como app de escritorio. selfDestroying estuvo activo
      // mientras un SW viejo servía builds cacheados; con autoUpdate +
      // skipWaiting + cleanupOutdatedCaches las actualizaciones aplican solas.
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "favicon.png", "apple-touch-icon.png"],
      manifest: {
        name: "REG-X ERP/POS",
        short_name: "REG-X",
        description: "Sistema ERP/POS SaaS Enterprise",
        theme_color: "#F20D18",
        background_color: "#111827",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ],
        categories: ["business", "productivity"],
        shortcuts: [
          { name: "POS", short_name: "POS", url: "/pos", icons: [{ src: "/pwa-64x64.png", sizes: "64x64" }] },
          { name: "Dashboard", short_name: "Panel", url: "/dashboard", icons: [{ src: "/pwa-64x64.png", sizes: "64x64" }] }
        ],
        prefer_related_applications: false
      },
      workbox: {
        // .wasm incluido para precachear el motor del escáner de códigos (zxing-wasm)
        // cuando Vite lo empaqueta al origen. Así el escáner funciona offline.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,wasm}"],
        // El .wasm del escáner ronda 1–2 MB; subimos el límite de precache (default 2 MiB).
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Si zxing-wasm carga su .wasm desde CDN (jsDelivr/unpkg/fastly),
            // lo guardamos tras el primer uso online para que luego funcione offline.
            urlPattern: /^https:\/\/(?:cdn\.jsdelivr\.net|fastly\.jsdelivr\.net|unpkg\.com)\/npm\/zxing-wasm.*\.wasm$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "zxing-wasm-cache",
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 5 },
              networkTimeoutSeconds: 10
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-storage-cache",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          },
          {
            urlPattern: /\/api\/v1\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 2 },
              networkTimeoutSeconds: 8
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src"),
      "@modules": path.resolve(__vite_injected_original_dirname, "./src/modules"),
      "@shared": path.resolve(__vite_injected_original_dirname, "./src/shared"),
      "@store": path.resolve(__vite_injected_original_dirname, "./src/store"),
      "@lib": path.resolve(__vite_injected_original_dirname, "./src/lib"),
      "@hooks": path.resolve(__vite_injected_original_dirname, "./src/hooks"),
      "@types": path.resolve(__vite_injected_original_dirname, "./src/types")
    }
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true
      }
    }
  },
  build: {
    target: "esnext",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-ui": ["framer-motion", "lucide-react"],
          "vendor-forms": ["react-hook-form", "zod", "@hookform/resolvers"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-charts": ["recharts"]
        }
      }
    }
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "@supabase/supabase-js"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxwcm95ZWN0b3NfcGVyc29uYWxlc1xcXFxSRUctWFxcXFxmcm9udGVuZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRDpcXFxccHJveWVjdG9zX3BlcnNvbmFsZXNcXFxcUkVHLVhcXFxcZnJvbnRlbmRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Q6L3Byb3llY3Rvc19wZXJzb25hbGVzL1JFRy1YL2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJ1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zOiBbXHJcbiAgICByZWFjdCgpLFxyXG4gICAgVml0ZVBXQSh7XHJcbiAgICAgIC8vIFBXQSBpbnN0YWxhYmxlIGNvbW8gYXBwIGRlIGVzY3JpdG9yaW8uIHNlbGZEZXN0cm95aW5nIGVzdHV2byBhY3Rpdm9cclxuICAgICAgLy8gbWllbnRyYXMgdW4gU1cgdmllam8gc2Vydlx1MDBFRGEgYnVpbGRzIGNhY2hlYWRvczsgY29uIGF1dG9VcGRhdGUgK1xyXG4gICAgICAvLyBza2lwV2FpdGluZyArIGNsZWFudXBPdXRkYXRlZENhY2hlcyBsYXMgYWN0dWFsaXphY2lvbmVzIGFwbGljYW4gc29sYXMuXHJcbiAgICAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLFxyXG4gICAgICBpbmNsdWRlQXNzZXRzOiBbJ2Zhdmljb24uaWNvJywgJ2Zhdmljb24ucG5nJywgJ2FwcGxlLXRvdWNoLWljb24ucG5nJ10sXHJcbiAgICAgIG1hbmlmZXN0OiB7XHJcbiAgICAgICAgbmFtZTogJ1JFRy1YIEVSUC9QT1MnLFxyXG4gICAgICAgIHNob3J0X25hbWU6ICdSRUctWCcsXHJcbiAgICAgICAgZGVzY3JpcHRpb246ICdTaXN0ZW1hIEVSUC9QT1MgU2FhUyBFbnRlcnByaXNlJyxcclxuICAgICAgICB0aGVtZV9jb2xvcjogJyNGMjBEMTgnLFxyXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6ICcjMTExODI3JyxcclxuICAgICAgICBkaXNwbGF5OiAnc3RhbmRhbG9uZScsXHJcbiAgICAgICAgb3JpZW50YXRpb246ICdhbnknLFxyXG4gICAgICAgIHN0YXJ0X3VybDogJy8nLFxyXG4gICAgICAgIHNjb3BlOiAnLycsXHJcbiAgICAgICAgaWNvbnM6IFtcclxuICAgICAgICAgIHsgc3JjOiAncHdhLTY0eDY0LnBuZycsIHNpemVzOiAnNjR4NjQnLCB0eXBlOiAnaW1hZ2UvcG5nJyB9LFxyXG4gICAgICAgICAgeyBzcmM6ICdwd2EtMTkyeDE5Mi5wbmcnLCBzaXplczogJzE5MngxOTInLCB0eXBlOiAnaW1hZ2UvcG5nJyB9LFxyXG4gICAgICAgICAgeyBzcmM6ICdwd2EtNTEyeDUxMi5wbmcnLCBzaXplczogJzUxMng1MTInLCB0eXBlOiAnaW1hZ2UvcG5nJywgcHVycG9zZTogJ2FueScgfSxcclxuICAgICAgICAgIHsgc3JjOiAnbWFza2FibGUtaWNvbi01MTJ4NTEyLnBuZycsIHNpemVzOiAnNTEyeDUxMicsIHR5cGU6ICdpbWFnZS9wbmcnLCBwdXJwb3NlOiAnbWFza2FibGUnIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgICBjYXRlZ29yaWVzOiBbJ2J1c2luZXNzJywgJ3Byb2R1Y3Rpdml0eSddLFxyXG4gICAgICAgIHNob3J0Y3V0czogW1xyXG4gICAgICAgICAgeyBuYW1lOiAnUE9TJywgc2hvcnRfbmFtZTogJ1BPUycsIHVybDogJy9wb3MnLCBpY29uczogW3sgc3JjOiAnL3B3YS02NHg2NC5wbmcnLCBzaXplczogJzY0eDY0JyB9XSB9LFxyXG4gICAgICAgICAgeyBuYW1lOiAnRGFzaGJvYXJkJywgc2hvcnRfbmFtZTogJ1BhbmVsJywgdXJsOiAnL2Rhc2hib2FyZCcsIGljb25zOiBbeyBzcmM6ICcvcHdhLTY0eDY0LnBuZycsIHNpemVzOiAnNjR4NjQnIH1dIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgICBwcmVmZXJfcmVsYXRlZF9hcHBsaWNhdGlvbnM6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgICB3b3JrYm94OiB7XHJcbiAgICAgICAgLy8gLndhc20gaW5jbHVpZG8gcGFyYSBwcmVjYWNoZWFyIGVsIG1vdG9yIGRlbCBlc2NcdTAwRTFuZXIgZGUgY1x1MDBGM2RpZ29zICh6eGluZy13YXNtKVxyXG4gICAgICAgIC8vIGN1YW5kbyBWaXRlIGxvIGVtcGFxdWV0YSBhbCBvcmlnZW4uIEFzXHUwMEVEIGVsIGVzY1x1MDBFMW5lciBmdW5jaW9uYSBvZmZsaW5lLlxyXG4gICAgICAgIGdsb2JQYXR0ZXJuczogWycqKi8qLntqcyxjc3MsaHRtbCxpY28scG5nLHN2Zyx3b2ZmMix3YXNtfSddLFxyXG4gICAgICAgIC8vIEVsIC53YXNtIGRlbCBlc2NcdTAwRTFuZXIgcm9uZGEgMVx1MjAxMzIgTUI7IHN1Ymltb3MgZWwgbFx1MDBFRG1pdGUgZGUgcHJlY2FjaGUgKGRlZmF1bHQgMiBNaUIpLlxyXG4gICAgICAgIG1heGltdW1GaWxlU2l6ZVRvQ2FjaGVJbkJ5dGVzOiA2ICogMTAyNCAqIDEwMjQsXHJcbiAgICAgICAgbmF2aWdhdGVGYWxsYmFjazogJy9pbmRleC5odG1sJyxcclxuICAgICAgICBuYXZpZ2F0ZUZhbGxiYWNrRGVueWxpc3Q6IFsvXlxcL2FwaS9dLFxyXG4gICAgICAgIHJ1bnRpbWVDYWNoaW5nOiBbXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIC8vIFNpIHp4aW5nLXdhc20gY2FyZ2Egc3UgLndhc20gZGVzZGUgQ0ROIChqc0RlbGl2ci91bnBrZy9mYXN0bHkpLFxyXG4gICAgICAgICAgICAvLyBsbyBndWFyZGFtb3MgdHJhcyBlbCBwcmltZXIgdXNvIG9ubGluZSBwYXJhIHF1ZSBsdWVnbyBmdW5jaW9uZSBvZmZsaW5lLlxyXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcLyg/OmNkblxcLmpzZGVsaXZyXFwubmV0fGZhc3RseVxcLmpzZGVsaXZyXFwubmV0fHVucGtnXFwuY29tKVxcL25wbVxcL3p4aW5nLXdhc20uKlxcLndhc20kL2ksXHJcbiAgICAgICAgICAgIGhhbmRsZXI6ICdDYWNoZUZpcnN0JyxcclxuICAgICAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgIGNhY2hlTmFtZTogJ3p4aW5nLXdhc20tY2FjaGUnLFxyXG4gICAgICAgICAgICAgIGV4cGlyYXRpb246IHsgbWF4RW50cmllczogNCwgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogMzY1IH0sXHJcbiAgICAgICAgICAgICAgY2FjaGVhYmxlUmVzcG9uc2U6IHsgc3RhdHVzZXM6IFswLCAyMDBdIH0sXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcLy4qXFwuc3VwYWJhc2VcXC5jb1xcL3Jlc3RcXC8uKi9pLFxyXG4gICAgICAgICAgICBoYW5kbGVyOiAnTmV0d29ya0ZpcnN0JyxcclxuICAgICAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgIGNhY2hlTmFtZTogJ3N1cGFiYXNlLWFwaS1jYWNoZScsXHJcbiAgICAgICAgICAgICAgZXhwaXJhdGlvbjogeyBtYXhFbnRyaWVzOiAyMDAsIG1heEFnZVNlY29uZHM6IDYwICogNSB9LFxyXG4gICAgICAgICAgICAgIG5ldHdvcmtUaW1lb3V0U2Vjb25kczogMTAsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcLy4qXFwuc3VwYWJhc2VcXC5jb1xcL3N0b3JhZ2VcXC8uKi9pLFxyXG4gICAgICAgICAgICBoYW5kbGVyOiAnQ2FjaGVGaXJzdCcsXHJcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdzdXBhYmFzZS1zdG9yYWdlLWNhY2hlJyxcclxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7IG1heEVudHJpZXM6IDUwMCwgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogNyB9LFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgdXJsUGF0dGVybjogL1xcL2FwaVxcL3YxXFwvLiovaSxcclxuICAgICAgICAgICAgaGFuZGxlcjogJ05ldHdvcmtGaXJzdCcsXHJcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdhcGktY2FjaGUnLFxyXG4gICAgICAgICAgICAgIGV4cGlyYXRpb246IHsgbWF4RW50cmllczogMTAwLCBtYXhBZ2VTZWNvbmRzOiA2MCAqIDIgfSxcclxuICAgICAgICAgICAgICBuZXR3b3JrVGltZW91dFNlY29uZHM6IDgsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXFwuKD86cG5nfGpwZ3xqcGVnfHN2Z3xnaWZ8d2VicCkkLyxcclxuICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLFxyXG4gICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnaW1hZ2VzLWNhY2hlJyxcclxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7IG1heEVudHJpZXM6IDMwMCwgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogMzAgfSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgICBza2lwV2FpdGluZzogdHJ1ZSxcclxuICAgICAgICBjbGllbnRzQ2xhaW06IHRydWUsXHJcbiAgICAgICAgY2xlYW51cE91dGRhdGVkQ2FjaGVzOiB0cnVlLFxyXG4gICAgICB9LFxyXG4gICAgICBkZXZPcHRpb25zOiB7XHJcbiAgICAgICAgZW5hYmxlZDogZmFsc2UsXHJcbiAgICAgIH0sXHJcbiAgICB9KSxcclxuICBdLFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgICdAJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXHJcbiAgICAgICdAbW9kdWxlcyc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYy9tb2R1bGVzJyksXHJcbiAgICAgICdAc2hhcmVkJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjL3NoYXJlZCcpLFxyXG4gICAgICAnQHN0b3JlJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjL3N0b3JlJyksXHJcbiAgICAgICdAbGliJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjL2xpYicpLFxyXG4gICAgICAnQGhvb2tzJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjL2hvb2tzJyksXHJcbiAgICAgICdAdHlwZXMnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMvdHlwZXMnKSxcclxuICAgIH0sXHJcbiAgfSxcclxuICBzZXJ2ZXI6IHtcclxuICAgIHBvcnQ6IDUxNzMsXHJcbiAgICBob3N0OiB0cnVlLFxyXG4gICAgcHJveHk6IHtcclxuICAgICAgJy9hcGknOiB7XHJcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDozMDAwJyxcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIHRhcmdldDogJ2VzbmV4dCcsXHJcbiAgICBzb3VyY2VtYXA6IHRydWUsXHJcbiAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIG1hbnVhbENodW5rczoge1xyXG4gICAgICAgICAgJ3ZlbmRvci1yZWFjdCc6IFsncmVhY3QnLCAncmVhY3QtZG9tJywgJ3JlYWN0LXJvdXRlci1kb20nXSxcclxuICAgICAgICAgICd2ZW5kb3ItcXVlcnknOiBbJ0B0YW5zdGFjay9yZWFjdC1xdWVyeSddLFxyXG4gICAgICAgICAgJ3ZlbmRvci11aSc6IFsnZnJhbWVyLW1vdGlvbicsICdsdWNpZGUtcmVhY3QnXSxcclxuICAgICAgICAgICd2ZW5kb3ItZm9ybXMnOiBbJ3JlYWN0LWhvb2stZm9ybScsICd6b2QnLCAnQGhvb2tmb3JtL3Jlc29sdmVycyddLFxyXG4gICAgICAgICAgJ3ZlbmRvci1zdXBhYmFzZSc6IFsnQHN1cGFiYXNlL3N1cGFiYXNlLWpzJ10sXHJcbiAgICAgICAgICAndmVuZG9yLWNoYXJ0cyc6IFsncmVjaGFydHMnXSxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9LFxyXG4gIG9wdGltaXplRGVwczoge1xyXG4gICAgaW5jbHVkZTogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3Qtcm91dGVyLWRvbScsICdAc3VwYWJhc2Uvc3VwYWJhc2UtanMnXSxcclxuICB9LFxyXG59KVxyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTRTLFNBQVMsb0JBQW9CO0FBQ3pVLE9BQU8sV0FBVztBQUNsQixTQUFTLGVBQWU7QUFDeEIsT0FBTyxVQUFVO0FBSGpCLElBQU0sbUNBQW1DO0FBTXpDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVB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
