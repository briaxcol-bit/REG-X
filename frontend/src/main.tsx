import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// ── PWA Service Worker ───────────────────────────────────────
// Actualización controlada: un POS no puede recargarse solo en plena venta.
// Cuando hay versión nueva: si ningún carrito tiene ítems → actualiza ya;
// si hay una venta en curso → toast con botón "Actualizar" (y se aplica
// sola en el próximo arranque de la app de todas formas).
import { registerSW } from 'virtual:pwa-register'
import { toast } from 'sonner'
import { usePOSStore } from '@store/pos.store'

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    const hasItemsInCart = usePOSStore.getState().tabs.some(t => t.items.length > 0)
    if (!hasItemsInCart) {
      void updateSW(true) // recarga con la versión nueva
      return
    }
    toast.info('Hay una nueva versión de REG-X', {
      description: 'Se aplicará al reiniciar la app, o actualiza ahora.',
      duration: Infinity,
      action: { label: 'Actualizar', onClick: () => void updateSW(true) },
    })
  },
  onRegisteredSW(_swUrl, registration) {
    // Revisar si hay versión nueva cada 5 min (además del chequeo al navegar).
    if (registration) {
      setInterval(() => registration.update().catch(() => {}), 5 * 60_000)
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
