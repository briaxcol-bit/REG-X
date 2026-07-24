// vite.config.ts
import { defineConfig } from "file:///C:/Users/57323/OneDrive/Escritorio/REG-X/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/57323/OneDrive/Escritorio/REG-X/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///C:/Users/57323/OneDrive/Escritorio/REG-X/node_modules/vite-plugin-pwa/dist/index.js";
import path from "path";
var __vite_injected_original_dirname = "C:\\Users\\57323\\OneDrive\\Escritorio\\REG-X\\frontend";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    VitePWA({
      // PWA instalable como app de escritorio.
      // 'prompt': la versión nueva NO recarga la página sola (un POS no puede
      // reiniciarse en plena venta). main.tsx decide: si no hay carritos con
      // ítems actualiza de inmediato; si los hay, muestra un aviso con botón.
      registerType: "prompt",
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
              // 3 días: NetworkFirst siempre prefiere la red; el cache solo se usa
              // como respaldo offline (catálogo, categorías, etc.)
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 3 },
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
        // skipWaiting/clientsClaim desactivados: el SW nuevo espera a que
        // main.tsx lo active (updateSW) — evita recargas a mitad de venta.
        skipWaiting: false,
        clientsClaim: false,
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFw1NzMyM1xcXFxPbmVEcml2ZVxcXFxFc2NyaXRvcmlvXFxcXFJFRy1YXFxcXGZyb250ZW5kXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFw1NzMyM1xcXFxPbmVEcml2ZVxcXFxFc2NyaXRvcmlvXFxcXFJFRy1YXFxcXGZyb250ZW5kXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy81NzMyMy9PbmVEcml2ZS9Fc2NyaXRvcmlvL1JFRy1YL2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJ1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zOiBbXHJcbiAgICByZWFjdCgpLFxyXG4gICAgVml0ZVBXQSh7XHJcbiAgICAgIC8vIFBXQSBpbnN0YWxhYmxlIGNvbW8gYXBwIGRlIGVzY3JpdG9yaW8uXHJcbiAgICAgIC8vICdwcm9tcHQnOiBsYSB2ZXJzaVx1MDBGM24gbnVldmEgTk8gcmVjYXJnYSBsYSBwXHUwMEUxZ2luYSBzb2xhICh1biBQT1Mgbm8gcHVlZGVcclxuICAgICAgLy8gcmVpbmljaWFyc2UgZW4gcGxlbmEgdmVudGEpLiBtYWluLnRzeCBkZWNpZGU6IHNpIG5vIGhheSBjYXJyaXRvcyBjb25cclxuICAgICAgLy8gXHUwMEVEdGVtcyBhY3R1YWxpemEgZGUgaW5tZWRpYXRvOyBzaSBsb3MgaGF5LCBtdWVzdHJhIHVuIGF2aXNvIGNvbiBib3RcdTAwRjNuLlxyXG4gICAgICByZWdpc3RlclR5cGU6ICdwcm9tcHQnLFxyXG4gICAgICBpbmNsdWRlQXNzZXRzOiBbJ2Zhdmljb24uaWNvJywgJ2Zhdmljb24ucG5nJywgJ2FwcGxlLXRvdWNoLWljb24ucG5nJ10sXHJcbiAgICAgIG1hbmlmZXN0OiB7XHJcbiAgICAgICAgbmFtZTogJ1JFRy1YIEVSUC9QT1MnLFxyXG4gICAgICAgIHNob3J0X25hbWU6ICdSRUctWCcsXHJcbiAgICAgICAgZGVzY3JpcHRpb246ICdTaXN0ZW1hIEVSUC9QT1MgU2FhUyBFbnRlcnByaXNlJyxcclxuICAgICAgICB0aGVtZV9jb2xvcjogJyNGMjBEMTgnLFxyXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6ICcjMTExODI3JyxcclxuICAgICAgICBkaXNwbGF5OiAnc3RhbmRhbG9uZScsXHJcbiAgICAgICAgb3JpZW50YXRpb246ICdhbnknLFxyXG4gICAgICAgIHN0YXJ0X3VybDogJy8nLFxyXG4gICAgICAgIHNjb3BlOiAnLycsXHJcbiAgICAgICAgaWNvbnM6IFtcclxuICAgICAgICAgIHsgc3JjOiAncHdhLTY0eDY0LnBuZycsIHNpemVzOiAnNjR4NjQnLCB0eXBlOiAnaW1hZ2UvcG5nJyB9LFxyXG4gICAgICAgICAgeyBzcmM6ICdwd2EtMTkyeDE5Mi5wbmcnLCBzaXplczogJzE5MngxOTInLCB0eXBlOiAnaW1hZ2UvcG5nJyB9LFxyXG4gICAgICAgICAgeyBzcmM6ICdwd2EtNTEyeDUxMi5wbmcnLCBzaXplczogJzUxMng1MTInLCB0eXBlOiAnaW1hZ2UvcG5nJywgcHVycG9zZTogJ2FueScgfSxcclxuICAgICAgICAgIHsgc3JjOiAnbWFza2FibGUtaWNvbi01MTJ4NTEyLnBuZycsIHNpemVzOiAnNTEyeDUxMicsIHR5cGU6ICdpbWFnZS9wbmcnLCBwdXJwb3NlOiAnbWFza2FibGUnIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgICBjYXRlZ29yaWVzOiBbJ2J1c2luZXNzJywgJ3Byb2R1Y3Rpdml0eSddLFxyXG4gICAgICAgIHNob3J0Y3V0czogW1xyXG4gICAgICAgICAgeyBuYW1lOiAnUE9TJywgc2hvcnRfbmFtZTogJ1BPUycsIHVybDogJy9wb3MnLCBpY29uczogW3sgc3JjOiAnL3B3YS02NHg2NC5wbmcnLCBzaXplczogJzY0eDY0JyB9XSB9LFxyXG4gICAgICAgICAgeyBuYW1lOiAnRGFzaGJvYXJkJywgc2hvcnRfbmFtZTogJ1BhbmVsJywgdXJsOiAnL2Rhc2hib2FyZCcsIGljb25zOiBbeyBzcmM6ICcvcHdhLTY0eDY0LnBuZycsIHNpemVzOiAnNjR4NjQnIH1dIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgICBwcmVmZXJfcmVsYXRlZF9hcHBsaWNhdGlvbnM6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgICB3b3JrYm94OiB7XHJcbiAgICAgICAgLy8gLndhc20gaW5jbHVpZG8gcGFyYSBwcmVjYWNoZWFyIGVsIG1vdG9yIGRlbCBlc2NcdTAwRTFuZXIgZGUgY1x1MDBGM2RpZ29zICh6eGluZy13YXNtKVxyXG4gICAgICAgIC8vIGN1YW5kbyBWaXRlIGxvIGVtcGFxdWV0YSBhbCBvcmlnZW4uIEFzXHUwMEVEIGVsIGVzY1x1MDBFMW5lciBmdW5jaW9uYSBvZmZsaW5lLlxyXG4gICAgICAgIGdsb2JQYXR0ZXJuczogWycqKi8qLntqcyxjc3MsaHRtbCxpY28scG5nLHN2Zyx3b2ZmMix3YXNtfSddLFxyXG4gICAgICAgIC8vIEVsIC53YXNtIGRlbCBlc2NcdTAwRTFuZXIgcm9uZGEgMVx1MjAxMzIgTUI7IHN1Ymltb3MgZWwgbFx1MDBFRG1pdGUgZGUgcHJlY2FjaGUgKGRlZmF1bHQgMiBNaUIpLlxyXG4gICAgICAgIG1heGltdW1GaWxlU2l6ZVRvQ2FjaGVJbkJ5dGVzOiA2ICogMTAyNCAqIDEwMjQsXHJcbiAgICAgICAgbmF2aWdhdGVGYWxsYmFjazogJy9pbmRleC5odG1sJyxcclxuICAgICAgICBuYXZpZ2F0ZUZhbGxiYWNrRGVueWxpc3Q6IFsvXlxcL2FwaS9dLFxyXG4gICAgICAgIHJ1bnRpbWVDYWNoaW5nOiBbXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIC8vIFNpIHp4aW5nLXdhc20gY2FyZ2Egc3UgLndhc20gZGVzZGUgQ0ROIChqc0RlbGl2ci91bnBrZy9mYXN0bHkpLFxyXG4gICAgICAgICAgICAvLyBsbyBndWFyZGFtb3MgdHJhcyBlbCBwcmltZXIgdXNvIG9ubGluZSBwYXJhIHF1ZSBsdWVnbyBmdW5jaW9uZSBvZmZsaW5lLlxyXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcLyg/OmNkblxcLmpzZGVsaXZyXFwubmV0fGZhc3RseVxcLmpzZGVsaXZyXFwubmV0fHVucGtnXFwuY29tKVxcL25wbVxcL3p4aW5nLXdhc20uKlxcLndhc20kL2ksXHJcbiAgICAgICAgICAgIGhhbmRsZXI6ICdDYWNoZUZpcnN0JyxcclxuICAgICAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgIGNhY2hlTmFtZTogJ3p4aW5nLXdhc20tY2FjaGUnLFxyXG4gICAgICAgICAgICAgIGV4cGlyYXRpb246IHsgbWF4RW50cmllczogNCwgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogMzY1IH0sXHJcbiAgICAgICAgICAgICAgY2FjaGVhYmxlUmVzcG9uc2U6IHsgc3RhdHVzZXM6IFswLCAyMDBdIH0sXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcLy4qXFwuc3VwYWJhc2VcXC5jb1xcL3Jlc3RcXC8uKi9pLFxyXG4gICAgICAgICAgICBoYW5kbGVyOiAnTmV0d29ya0ZpcnN0JyxcclxuICAgICAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgIGNhY2hlTmFtZTogJ3N1cGFiYXNlLWFwaS1jYWNoZScsXHJcbiAgICAgICAgICAgICAgLy8gMyBkXHUwMEVEYXM6IE5ldHdvcmtGaXJzdCBzaWVtcHJlIHByZWZpZXJlIGxhIHJlZDsgZWwgY2FjaGUgc29sbyBzZSB1c2FcclxuICAgICAgICAgICAgICAvLyBjb21vIHJlc3BhbGRvIG9mZmxpbmUgKGNhdFx1MDBFMWxvZ28sIGNhdGVnb3JcdTAwRURhcywgZXRjLilcclxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7IG1heEVudHJpZXM6IDUwMCwgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogMyB9LFxyXG4gICAgICAgICAgICAgIG5ldHdvcmtUaW1lb3V0U2Vjb25kczogMTAsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcLy4qXFwuc3VwYWJhc2VcXC5jb1xcL3N0b3JhZ2VcXC8uKi9pLFxyXG4gICAgICAgICAgICBoYW5kbGVyOiAnQ2FjaGVGaXJzdCcsXHJcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdzdXBhYmFzZS1zdG9yYWdlLWNhY2hlJyxcclxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7IG1heEVudHJpZXM6IDUwMCwgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogNyB9LFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgdXJsUGF0dGVybjogL1xcL2FwaVxcL3YxXFwvLiovaSxcclxuICAgICAgICAgICAgaGFuZGxlcjogJ05ldHdvcmtGaXJzdCcsXHJcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdhcGktY2FjaGUnLFxyXG4gICAgICAgICAgICAgIGV4cGlyYXRpb246IHsgbWF4RW50cmllczogMTAwLCBtYXhBZ2VTZWNvbmRzOiA2MCAqIDIgfSxcclxuICAgICAgICAgICAgICBuZXR3b3JrVGltZW91dFNlY29uZHM6IDgsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXFwuKD86cG5nfGpwZ3xqcGVnfHN2Z3xnaWZ8d2VicCkkLyxcclxuICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLFxyXG4gICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnaW1hZ2VzLWNhY2hlJyxcclxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7IG1heEVudHJpZXM6IDMwMCwgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogMzAgfSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyBza2lwV2FpdGluZy9jbGllbnRzQ2xhaW0gZGVzYWN0aXZhZG9zOiBlbCBTVyBudWV2byBlc3BlcmEgYSBxdWVcclxuICAgICAgICAvLyBtYWluLnRzeCBsbyBhY3RpdmUgKHVwZGF0ZVNXKSBcdTIwMTQgZXZpdGEgcmVjYXJnYXMgYSBtaXRhZCBkZSB2ZW50YS5cclxuICAgICAgICBza2lwV2FpdGluZzogZmFsc2UsXHJcbiAgICAgICAgY2xpZW50c0NsYWltOiBmYWxzZSxcclxuICAgICAgICBjbGVhbnVwT3V0ZGF0ZWRDYWNoZXM6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICAgIGRldk9wdGlvbnM6IHtcclxuICAgICAgICBlbmFibGVkOiBmYWxzZSxcclxuICAgICAgfSxcclxuICAgIH0pLFxyXG4gIF0sXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgJ0AnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMnKSxcclxuICAgICAgJ0Btb2R1bGVzJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjL21vZHVsZXMnKSxcclxuICAgICAgJ0BzaGFyZWQnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMvc2hhcmVkJyksXHJcbiAgICAgICdAc3RvcmUnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMvc3RvcmUnKSxcclxuICAgICAgJ0BsaWInOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMvbGliJyksXHJcbiAgICAgICdAaG9va3MnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMvaG9va3MnKSxcclxuICAgICAgJ0B0eXBlcyc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYy90eXBlcycpLFxyXG4gICAgfSxcclxuICB9LFxyXG4gIHNlcnZlcjoge1xyXG4gICAgcG9ydDogNTE3MyxcclxuICAgIGhvc3Q6IHRydWUsXHJcbiAgICBwcm94eToge1xyXG4gICAgICAnL2FwaSc6IHtcclxuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjMwMDAnLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxuICBidWlsZDoge1xyXG4gICAgdGFyZ2V0OiAnZXNuZXh0JyxcclxuICAgIHNvdXJjZW1hcDogdHJ1ZSxcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICAndmVuZG9yLXJlYWN0JzogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3Qtcm91dGVyLWRvbSddLFxyXG4gICAgICAgICAgJ3ZlbmRvci1xdWVyeSc6IFsnQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5J10sXHJcbiAgICAgICAgICAndmVuZG9yLXVpJzogWydmcmFtZXItbW90aW9uJywgJ2x1Y2lkZS1yZWFjdCddLFxyXG4gICAgICAgICAgJ3ZlbmRvci1mb3Jtcyc6IFsncmVhY3QtaG9vay1mb3JtJywgJ3pvZCcsICdAaG9va2Zvcm0vcmVzb2x2ZXJzJ10sXHJcbiAgICAgICAgICAndmVuZG9yLXN1cGFiYXNlJzogWydAc3VwYWJhc2Uvc3VwYWJhc2UtanMnXSxcclxuICAgICAgICAgICd2ZW5kb3ItY2hhcnRzJzogWydyZWNoYXJ0cyddLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgb3B0aW1pemVEZXBzOiB7XHJcbiAgICBpbmNsdWRlOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbScsICdyZWFjdC1yb3V0ZXItZG9tJywgJ0BzdXBhYmFzZS9zdXBhYmFzZS1qcyddLFxyXG4gIH0sXHJcbn0pXHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBbVYsU0FBUyxvQkFBb0I7QUFDaFgsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsZUFBZTtBQUN4QixPQUFPLFVBQVU7QUFIakIsSUFBTSxtQ0FBbUM7QUFNekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sUUFBUTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFLTixjQUFjO0FBQUEsTUFDZCxlQUFlLENBQUMsZUFBZSxlQUFlLHNCQUFzQjtBQUFBLE1BQ3BFLFVBQVU7QUFBQSxRQUNSLE1BQU07QUFBQSxRQUNOLFlBQVk7QUFBQSxRQUNaLGFBQWE7QUFBQSxRQUNiLGFBQWE7QUFBQSxRQUNiLGtCQUFrQjtBQUFBLFFBQ2xCLFNBQVM7QUFBQSxRQUNULGFBQWE7QUFBQSxRQUNiLFdBQVc7QUFBQSxRQUNYLE9BQU87QUFBQSxRQUNQLE9BQU87QUFBQSxVQUNMLEVBQUUsS0FBSyxpQkFBaUIsT0FBTyxTQUFTLE1BQU0sWUFBWTtBQUFBLFVBQzFELEVBQUUsS0FBSyxtQkFBbUIsT0FBTyxXQUFXLE1BQU0sWUFBWTtBQUFBLFVBQzlELEVBQUUsS0FBSyxtQkFBbUIsT0FBTyxXQUFXLE1BQU0sYUFBYSxTQUFTLE1BQU07QUFBQSxVQUM5RSxFQUFFLEtBQUssNkJBQTZCLE9BQU8sV0FBVyxNQUFNLGFBQWEsU0FBUyxXQUFXO0FBQUEsUUFDL0Y7QUFBQSxRQUNBLFlBQVksQ0FBQyxZQUFZLGNBQWM7QUFBQSxRQUN2QyxXQUFXO0FBQUEsVUFDVCxFQUFFLE1BQU0sT0FBTyxZQUFZLE9BQU8sS0FBSyxRQUFRLE9BQU8sQ0FBQyxFQUFFLEtBQUssa0JBQWtCLE9BQU8sUUFBUSxDQUFDLEVBQUU7QUFBQSxVQUNsRyxFQUFFLE1BQU0sYUFBYSxZQUFZLFNBQVMsS0FBSyxjQUFjLE9BQU8sQ0FBQyxFQUFFLEtBQUssa0JBQWtCLE9BQU8sUUFBUSxDQUFDLEVBQUU7QUFBQSxRQUNsSDtBQUFBLFFBQ0EsNkJBQTZCO0FBQUEsTUFDL0I7QUFBQSxNQUNBLFNBQVM7QUFBQTtBQUFBO0FBQUEsUUFHUCxjQUFjLENBQUMsMkNBQTJDO0FBQUE7QUFBQSxRQUUxRCwrQkFBK0IsSUFBSSxPQUFPO0FBQUEsUUFDMUMsa0JBQWtCO0FBQUEsUUFDbEIsMEJBQTBCLENBQUMsUUFBUTtBQUFBLFFBQ25DLGdCQUFnQjtBQUFBLFVBQ2Q7QUFBQTtBQUFBO0FBQUEsWUFHRSxZQUFZO0FBQUEsWUFDWixTQUFTO0FBQUEsWUFDVCxTQUFTO0FBQUEsY0FDUCxXQUFXO0FBQUEsY0FDWCxZQUFZLEVBQUUsWUFBWSxHQUFHLGVBQWUsS0FBSyxLQUFLLEtBQUssSUFBSTtBQUFBLGNBQy9ELG1CQUFtQixFQUFFLFVBQVUsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFlBQzFDO0FBQUEsVUFDRjtBQUFBLFVBQ0E7QUFBQSxZQUNFLFlBQVk7QUFBQSxZQUNaLFNBQVM7QUFBQSxZQUNULFNBQVM7QUFBQSxjQUNQLFdBQVc7QUFBQTtBQUFBO0FBQUEsY0FHWCxZQUFZLEVBQUUsWUFBWSxLQUFLLGVBQWUsS0FBSyxLQUFLLEtBQUssRUFBRTtBQUFBLGNBQy9ELHVCQUF1QjtBQUFBLFlBQ3pCO0FBQUEsVUFDRjtBQUFBLFVBQ0E7QUFBQSxZQUNFLFlBQVk7QUFBQSxZQUNaLFNBQVM7QUFBQSxZQUNULFNBQVM7QUFBQSxjQUNQLFdBQVc7QUFBQSxjQUNYLFlBQVksRUFBRSxZQUFZLEtBQUssZUFBZSxLQUFLLEtBQUssS0FBSyxFQUFFO0FBQUEsWUFDakU7QUFBQSxVQUNGO0FBQUEsVUFDQTtBQUFBLFlBQ0UsWUFBWTtBQUFBLFlBQ1osU0FBUztBQUFBLFlBQ1QsU0FBUztBQUFBLGNBQ1AsV0FBVztBQUFBLGNBQ1gsWUFBWSxFQUFFLFlBQVksS0FBSyxlQUFlLEtBQUssRUFBRTtBQUFBLGNBQ3JELHVCQUF1QjtBQUFBLFlBQ3pCO0FBQUEsVUFDRjtBQUFBLFVBQ0E7QUFBQSxZQUNFLFlBQVk7QUFBQSxZQUNaLFNBQVM7QUFBQSxZQUNULFNBQVM7QUFBQSxjQUNQLFdBQVc7QUFBQSxjQUNYLFlBQVksRUFBRSxZQUFZLEtBQUssZUFBZSxLQUFLLEtBQUssS0FBSyxHQUFHO0FBQUEsWUFDbEU7QUFBQSxVQUNGO0FBQUEsUUFDRjtBQUFBO0FBQUE7QUFBQSxRQUdBLGFBQWE7QUFBQSxRQUNiLGNBQWM7QUFBQSxRQUNkLHVCQUF1QjtBQUFBLE1BQ3pCO0FBQUEsTUFDQSxZQUFZO0FBQUEsUUFDVixTQUFTO0FBQUEsTUFDWDtBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxNQUNwQyxZQUFZLEtBQUssUUFBUSxrQ0FBVyxlQUFlO0FBQUEsTUFDbkQsV0FBVyxLQUFLLFFBQVEsa0NBQVcsY0FBYztBQUFBLE1BQ2pELFVBQVUsS0FBSyxRQUFRLGtDQUFXLGFBQWE7QUFBQSxNQUMvQyxRQUFRLEtBQUssUUFBUSxrQ0FBVyxXQUFXO0FBQUEsTUFDM0MsVUFBVSxLQUFLLFFBQVEsa0NBQVcsYUFBYTtBQUFBLE1BQy9DLFVBQVUsS0FBSyxRQUFRLGtDQUFXLGFBQWE7QUFBQSxJQUNqRDtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxRQUNOLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxNQUNoQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixXQUFXO0FBQUEsSUFDWCxlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUEsUUFDTixjQUFjO0FBQUEsVUFDWixnQkFBZ0IsQ0FBQyxTQUFTLGFBQWEsa0JBQWtCO0FBQUEsVUFDekQsZ0JBQWdCLENBQUMsdUJBQXVCO0FBQUEsVUFDeEMsYUFBYSxDQUFDLGlCQUFpQixjQUFjO0FBQUEsVUFDN0MsZ0JBQWdCLENBQUMsbUJBQW1CLE9BQU8scUJBQXFCO0FBQUEsVUFDaEUsbUJBQW1CLENBQUMsdUJBQXVCO0FBQUEsVUFDM0MsaUJBQWlCLENBQUMsVUFBVTtBQUFBLFFBQzlCO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsU0FBUyxhQUFhLG9CQUFvQix1QkFBdUI7QUFBQSxFQUM3RTtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
