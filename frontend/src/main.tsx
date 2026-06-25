import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// ── PWA Service Worker ───────────────────────────────────────
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Nueva versión disponible. ¿Actualizar ahora?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('[PWA] Aplicación lista para uso offline')
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
