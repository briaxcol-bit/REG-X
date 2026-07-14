/**
 * REG-X — Cajón monedero (cash drawer)
 *
 * Soporta dos modos de conexión:
 *
 * A) Web Serial (USB/Serie)
 *    El cajón va conectado por RJ11 a la impresora; la impresora por USB al PC.
 *    Usa la Web Serial API de Chrome/Edge. Solo funciona en desktop con HTTPS/localhost.
 *
 * B) Red (Ethernet/WiFi) — REQUIERE cash-drawer-bridge.js corriendo en el PC
 *    El cajón va conectado por RJ11 a la impresora; la impresora por Ethernet.
 *    El puente local escucha en http://localhost:8765 y reenvía el comando TCP.
 *    Configurar la IP de la impresora en Configuración → Cajón monedero.
 *
 * El modo activo se detecta automáticamente:
 *  - Si hay una URL de puente configurada → modo Red
 *  - Si no → modo Serial (comportamiento anterior)
 */

// ESC p m t1 t2 → pulso de ~50ms/500ms al pin 2 del RJ11
const KICK = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa])

// ── Clave localStorage para la URL del puente ─────────────────
const BRIDGE_URL_KEY = 'regx_cash_drawer_bridge'
const DEFAULT_BRIDGE  = 'http://localhost:8765'

// ── Helpers de configuración (usados en SettingsPage) ─────────
export function getCashDrawerBridgeUrl(): string {
  return localStorage.getItem(BRIDGE_URL_KEY) ?? ''
}
export function setCashDrawerBridgeUrl(url: string): void {
  if (url.trim()) {
    localStorage.setItem(BRIDGE_URL_KEY, url.trim())
  } else {
    localStorage.removeItem(BRIDGE_URL_KEY)
  }
}
/** true si el usuario configuró una URL de puente */
export function isBridgeMode(): boolean {
  return !!getCashDrawerBridgeUrl()
}

// ── Modo Red (puente TCP) ──────────────────────────────────────

/** Comprueba si el puente está corriendo. No lanza excepción. */
export async function cashDrawerBridgeOnline(): Promise<boolean> {
  const url = getCashDrawerBridgeUrl() || DEFAULT_BRIDGE
  try {
    const res = await fetch(`${url}/status`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

/** Abre el cajón via puente de red. */
export async function openCashDrawerNetwork(): Promise<boolean> {
  const url = getCashDrawerBridgeUrl() || DEFAULT_BRIDGE
  try {
    const res = await fetch(`${url}/open`, {
      method: 'POST',
      signal: AbortSignal.timeout(4000),
    })
    return res.ok
  } catch (e) {
    console.warn('[cash-drawer] error red:', e)
    return false
  }
}

// ── Modo Serial (Web Serial API) ──────────────────────────────
interface SerialPortLike {
  readable: unknown
  writable: { getWriter(): { write(d: Uint8Array): Promise<void>; releaseLock(): void } } | null
  open(opts: { baudRate: number }): Promise<void>
}
interface SerialLike {
  getPorts(): Promise<SerialPortLike[]>
  requestPort(): Promise<SerialPortLike>
}

function serialApi(): SerialLike | null {
  return (navigator as unknown as { serial?: SerialLike }).serial ?? null
}

let cachedPort: SerialPortLike | null = null

/** ¿El navegador soporta Web Serial? (Chrome/Edge desktop) */
export function cashDrawerSupported(): boolean {
  return serialApi() !== null || true // siempre true: modo red es alternativa universal
}

/** ¿Ya hay un puerto serial autorizado? (no muestra diálogos) */
export async function cashDrawerLinked(): Promise<boolean> {
  if (isBridgeMode()) return cashDrawerBridgeOnline()
  const api = serialApi()
  if (!api) return false
  if (cachedPort) return true
  const ports = await api.getPorts()
  cachedPort = ports[0] ?? null
  return cachedPort !== null
}

/**
 * Vincula el puerto de la impresora/cajón (modo Serial).
 * DEBE llamarse desde un gesto del usuario (click).
 */
export async function linkCashDrawer(): Promise<boolean> {
  if (isBridgeMode()) return cashDrawerBridgeOnline()
  const api = serialApi()
  if (!api) return false
  try {
    cachedPort = await api.requestPort()
    return true
  } catch {
    return false
  }
}

/**
 * Abre el cajón. Elige automáticamente el modo según la configuración.
 * Silencioso: si falla devuelve false sin romper el flujo de venta.
 */
export async function openCashDrawer(): Promise<boolean> {
  // Modo red (puente TCP)
  if (isBridgeMode()) return openCashDrawerNetwork()

  // Modo serial
  try {
    if (!(await cashDrawerLinked()) || !cachedPort) return false
    if (!cachedPort.writable) {
      await cachedPort.open({ baudRate: 9600 })
    }
    const writer = cachedPort.writable!.getWriter()
    await writer.write(KICK)
    writer.releaseLock()
    return true
  } catch (e) {
    console.warn('[cash-drawer] no se pudo abrir el cajón:', e)
    return false
  }
}
