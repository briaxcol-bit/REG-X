/**
 * REG-X — Impresión directa de tickets ESC/POS.
 * Misma cascada que usa el checkout de la caja principal:
 *   1) Impresora USB (WebUSB — tablets/POS Android sin driver)
 *   2) Bridge de red (impresora Ethernet vía cash-drawer-bridge)
 * Devuelve { ok } para que el llamador decida el fallback
 * (p. ej. diálogo de impresión del navegador).
 */
import { isUsbPrinterSupported, usbPrinterLinked, linkUsbPrinter, printUsbRaw, usbAccessDenied, lastUsbError } from './usb-printer'
import { getCashDrawerBridgeUrl } from './cash-drawer'
import { bytesToBase64 } from './escpos'

export interface DirectPrintResult {
  ok: boolean
  /** Mensaje de error legible si falló la impresión directa */
  error?: string
}

export async function printEscPosDirect(escBytes: Uint8Array): Promise<DirectPrintResult> {
  // 1) USB directo — en PC Windows el SO suele negar el acceso
  //    (usbAccessDenied) y se sigue con el bridge / navegador.
  if (isUsbPrinterSupported() && !usbAccessDenied()) {
    let linked = await usbPrinterLinked()
    if (!linked) {
      // Abre el selector USB de Chrome (requiere gesto del usuario reciente)
      linked = await linkUsbPrinter()
    }
    if (linked) {
      const ok = await printUsbRaw(escBytes)
      if (ok) return { ok: true }
      if (!usbAccessDenied()) {
        return { ok: false, error: lastUsbError() || 'No se pudo imprimir por USB' }
      }
      // Acceso negado en PC: probar bridge/navegador
    }
  }

  // 2) Bridge de red (impresora por Ethernet)
  const bridgeUrl = getCashDrawerBridgeUrl()
  if (bridgeUrl) {
    try {
      const res = await fetch(`${bridgeUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: bytesToBase64(escBytes) }),
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) return { ok: true }
    } catch { /* cae al fallback del llamador */ }
  }

  return { ok: false }
}
