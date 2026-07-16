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

    // Seleccionar configuración
    if (device.configuration === null) {
      await device.selectConfiguration(1)
    }

    // Buscar CUALQUIER interfaz que tenga un endpoint OUT bulk.
    // No asumimos que sea la clase 7 ni la interfaz [0]: algunas
    // térmicas (como la E200L) exponen la impresora en otra interfaz.
    let target: { iface: USBInterface; endpointNumber: number } | null = null
    for (const iface of device.configuration?.interfaces ?? []) {
      for (const alt of iface.alternates) {
        const ep = alt.endpoints.find(e => e.direction === 'out' && e.type === 'bulk')
        if (ep) {
          target = { iface, endpointNumber: ep.endpointNumber }
          break
        }
      }
      if (target) break
    }

    if (!target) {
      console.warn('[usb-printer] no se encontró endpoint OUT bulk')
      return false
    }

    if (!target.iface.claimed) {
      await device.claimInterface(target.iface.interfaceNumber)
    }

    const result = await device.transferOut(target.endpointNumber, data)
    return result.status === 'ok'
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
