/**
 * REG-X — Instalación de la PWA
 *
 * Chrome/Edge/Android disparan `beforeinstallprompt` cuando la app es
 * instalable. Hay que capturarlo ANTES de que el usuario llegue a Ajustes
 * (este módulo se importa desde App.tsx, así que el listener queda activo
 * desde el arranque) y guardarlo para lanzarlo después desde un botón.
 *
 * iOS/Safari no soporta el evento: ahí la instalación es manual
 * (Compartir → "Agregar a pantalla de inicio").
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    listeners.forEach((l) => l())
  })
}

/** ¿La app ya corre instalada (ventana standalone)? */
export function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true // iOS
}

/** ¿El navegador ofreció instalación y está pendiente? */
export function canInstall(): boolean {
  return deferredPrompt !== null
}

/** ¿Es iOS/Safari (instalación manual)? */
export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

/** Lanza el diálogo nativo de instalación. Devuelve true si el usuario aceptó. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false
  await deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  if (outcome === 'accepted') deferredPrompt = null
  return outcome === 'accepted'
}

/** Suscripción a cambios de disponibilidad (para re-renderizar el botón). */
export function onInstallAvailabilityChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
