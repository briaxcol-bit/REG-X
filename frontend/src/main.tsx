import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// ── PWA Service Worker ───────────────────────────────────────
// Auto-actualización real: apenas hay una versión nueva desplegada, el SW
// nuevo toma el control (skipWaiting + clientsClaim en vite.config) y la
// página se recarga sola. Sin avisos ni pasos manuales.
import { registerSW } from 'virtual:pwa-register'

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    // Revisar si hay versión nueva cada 60s (además del chequeo al navegar).
    if (registration) {
      setInterval(() => registration.update().catch(() => {}), 60_000)
    }
  },
})

// ── Mount ────────────────────────────────────────────────────
const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
