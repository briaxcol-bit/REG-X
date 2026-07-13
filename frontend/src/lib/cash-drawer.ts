/**
 * REG-X — Cajón monedero (cash drawer)
 *
 * El cajón va conectado por RJ11 a la impresora térmica; se abre enviando
 * el comando ESC/POS "ESC p" (pulso al pin del cajón) al puerto de la
 * impresora vía Web Serial (Chrome/Edge de escritorio, HTTPS o localhost).
 *
 * Flujo:
 *  1. Primera vez: el cajero pulsa "Abrir cajón" (gesto de usuario) →
 *     el navegador muestra el selector de puerto → se guarda el permiso.
 *  2. Después: cada venta en EFECTIVO abre el cajón automáticamente,
 *     sin diálogos (el permiso del puerto queda concedido).
 *
 * Alternativa sin código: si el recibo se imprime por el driver de Windows,
 * casi todos los drivers térmicos tienen la opción "abrir cajón al imprimir".
 */

// ESC p m t1 t2 → pulso de ~50ms/500ms al pin 2 del RJ11
const KICK = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa])

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

/** ¿El navegador soporta Web Serial? (Chrome/Edge escritorio) */
export function cashDrawerSupported(): boolean {
  return serialApi() !== null
}

/** ¿Ya hay un puerto autorizado? (no muestra diálogos) */
export async function cashDrawerLinked(): Promise<boolean> {
  const api = serialApi()
  if (!api) return false
  if (cachedPort) return true
  const ports = await api.getPorts()
  cachedPort = ports[0] ?? null
  return cachedPort !== null
}

/**
 * Vincula el puerto de la impresora/cajón. DEBE llamarse desde un gesto
 * del usuario (click). Devuelve true si el usuario seleccionó un puerto.
 */
export async function linkCashDrawer(): Promise<boolean> {
  const api = serialApi()
  if (!api) return false
  try {
    cachedPort = await api.requestPort()
    return true
  } catch {
    return false // usuario canceló el selector
  }
}

/**
 * Abre el cajón. Silencioso: si no hay puerto vinculado o algo falla,
 * devuelve false sin romper el flujo de venta.
 */
export async function openCashDrawer(): Promise<boolean> {
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
