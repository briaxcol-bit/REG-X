/**
 * REG-X — Impresora térmica por WebUSB
 * Envía comandos ESC/POS directo a la impresora USB sin diálogo de impresión.
 * Compatible con Chrome Android 61+.
 *
 * Flujo:
 *  1. Primera vez: usuario toca "Vincular impresora" → Chrome muestra selector USB (una sola vez)
 *  2. Después: imprime directo sin ningún diálogo
 */

const ESCPOS_FILTERS = [
  // Filtros genéricos — acepta cualquier impresora térmica USB
  { classCode: 0x07 },           // Printer class
  { classCode: 0x00 },           // Vendor specific (muchas térmicas)
]

let cachedDevice: USBDevice | null = null

function usbApi(): USB | null {
  return (navigator as any).usb ?? null
}

export function isUsbPrinterSupported(): boolean {
  return usbApi() !== null
}

export async function usbPrinterLinked(): Promise<boolean> {
  const usb = usbApi()
  if (!usb) return false
  if (cachedDevice) return true
  try {
    const devices = await usb.getDevices()
    cachedDevice = devices[0] ?? null
    return cachedDevice !== null
  } catch {
    return false
  }
}

/** Vincula la impresora USB. DEBE llamarse desde un gesto del usuario (click). */
export async function linkUsbPrinter(): Promise<boolean> {
  const usb = usbApi()
  if (!usb) return false
  try {
    cachedDevice = await usb.requestDevice({ filters: ESCPOS_FILTERS })
    return true
  } catch {
    // Usuario canceló el selector
    return false
  }
}

/** Envía bytes ESC/POS a la impresora USB. */
export async function printUsbRaw(data: Uint8Array): Promise<boolean> {
  try {
    if (!cachedDevice) {
      const linked = await usbPrinterLinked()
      if (!linked) return false
    }
    const device = cachedDevice!

    if (!device.opened) await device.open()

    // Seleccionar configuración y reclamar interfaz de impresora
    if (device.configuration === null) {
      await device.selectConfiguration(1)
    }

    // Buscar interfaz de impresora (class 7) o la primera disponible
    const iface = device.configuration?.interfaces.find(
      i => i.alternates[0]?.interfaceClass === 0x07
    ) ?? device.configuration?.interfaces[0]

    if (!iface) return false

    if (!iface.claimed) await device.claimInterface(iface.interfaceNumber)

    // Buscar endpoint OUT bulk
    const endpoint = iface.alternates[0]?.endpoints.find(
      e => e.direction === 'out' && e.type === 'bulk'
    )

    if (!endpoint) return false

    await device.transferOut(endpoint.endpointNumber, data)
    return true
  } catch (e) {
    console.warn('[usb-printer] error:', e)
    cachedDevice = null // resetear para reconectar en el próximo intento
    return false
  }
}

/** Abre el cajón monedero via USB (comando ESC/POS kick). */
export async function openDrawerUsb(): Promise<boolean> {
  const KICK = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa])
  return printUsbRaw(KICK)
}
