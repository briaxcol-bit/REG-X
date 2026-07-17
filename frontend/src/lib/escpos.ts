/**
 * REG-X — Generador de comandos ESC/POS
 * Genera un recibo térmico como bytes ESC/POS listos para enviar
 * directamente al puerto 9100 de la impresora (sin pasar por el browser).
 *
 * Compatible con impresoras 58mm y 80mm (DIG-E200I, Xprinter, Epson, etc.)
 */

// ── Comandos ESC/POS ──────────────────────────────────────────
const ESC = 0x1b
const GS  = 0x1d
const LF  = 0x0a

const CMD = {
  init:        [ESC, 0x40],          // inicializar
  cut:         [GS,  0x56, 0x00],    // corte total
  feedCut:     [ESC, 0x64, 0x04, GS, 0x56, 0x00], // avanzar 4 líneas + cortar
  alignLeft:   [ESC, 0x61, 0x00],
  alignCenter: [ESC, 0x61, 0x01],
  alignRight:  [ESC, 0x61, 0x02],
  boldOn:      [ESC, 0x45, 0x01],
  boldOff:     [ESC, 0x45, 0x00],
  doubleOn:    [ESC, 0x21, 0x30],    // doble ancho + doble alto
  doubleOff:   [ESC, 0x21, 0x00],
  wideOn:      [ESC, 0x21, 0x20],    // solo doble ancho
  wideOff:     [ESC, 0x21, 0x00],
  // Pulso al cajón monedero (conector RJ11 de la impresora).
  // Se envían ambos pines (2 y 5) para cubrir cualquier cableado.
  drawerKick:  [ESC, 0x70, 0x00, 0x19, 0xfa, ESC, 0x70, 0x01, 0x19, 0xfa],
}

function encodeText(text: string): number[] {
  // Encoding básico latin-1 — compatible con la mayoría de impresoras térmicas
  const bytes: number[] = []
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c < 256) bytes.push(c)
    else bytes.push(0x3f) // '?' para caracteres fuera de latin-1
  }
  return bytes
}

function line(text = ''): number[] {
  return [...encodeText(text), LF]
}

function sep(char = '-', width = 32): number[] {
  return line(char.repeat(width))
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length)
}
function padLeft(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : ' '.repeat(len - str.length) + str
}

/** Fila etiqueta + valor alineado a la derecha */
function row(label: string, value: string, width: number): number[] {
  const valW = Math.max(value.length, 10)
  return line(padRight(label, width - valW) + padLeft(value, valW))
}

/** Ítem: nombre + total en una línea, cantidad × precio debajo */
function itemLine(name: string, qty: number, price: number, total: number, width = 32): number[] {
  const totalStr  = formatMoney(total)
  const nameWidth = width - totalStr.length - 1
  const out: number[] = []
  // Nombre puede ocupar varias líneas si es largo
  let rest = name
  let first = true
  while (rest.length > 0) {
    const chunk = rest.slice(0, nameWidth)
    rest = rest.slice(nameWidth)
    if (first) {
      out.push(...line(padRight(chunk, nameWidth) + ' ' + totalStr))
      first = false
    } else {
      out.push(...line(chunk))
    }
  }
  out.push(...line(`  ${qty} x ${formatMoney(price)}`))
  return out
}

function formatMoney(n: number): string {
  return `$${n.toLocaleString('es-CO')}`
}

// ── Interfaz pública ──────────────────────────────────────────
export interface EscPosReceiptData {
  businessName:   string
  branchName?:    string
  businessNit?:   string
  address?:       string
  phone?:         string
  header?:        string
  footer?:        string
  orderNumber:    string
  cashierName?:   string
  customerName?:  string
  customerDocId?: string
  customerPhone?: string
  waiterName?:    string
  date:           string
  items: {
    name:      string
    quantity:  number
    unitPrice: number
    total:     number
  }[]
  subtotal:       number
  taxTotal:       number
  /** Base gravable (subtotal - descuentos) */
  taxBase?:       number
  discountTotal:  number
  tip?:           number
  total:          number
  payments: { method: string; amount: number }[]
  cashReceived?:  number
  change?:        number
  /** Ancho de papel: 32 chars para 58mm, 48 chars para 80mm */
  paperWidth?: 32 | 48
  /** Abrir el cajón monedero conectado a la impresora (ventas en efectivo) */
  openDrawer?: boolean
}

const METHOD_LABEL: Record<string, string> = {
  CASH:      'Efectivo',
  CARD:      'Tarjeta',
  TRANSFER:  'Transferencia',
  GIFT_CARD: 'Gift Card',
  CREDIT:    'Crédito (fiado)',
  MIXED:     'Mixto',
}

export function buildEscPosReceipt(d: EscPosReceiptData): Uint8Array {
  const W = d.paperWidth ?? 32
  const bytes: number[] = []
  const push = (...args: (number | number[])[]) =>
    args.forEach(a => Array.isArray(a) ? bytes.push(...a) : bytes.push(a))

  // Inicializar
  push(CMD.init)

  // Abrir cajón monedero — el pulso viaja con el mismo trabajo de impresión
  if (d.openDrawer) push(CMD.drawerKick)

  // ── Encabezado negocio ─────────────────────────────────────
  push(CMD.alignCenter)
  if (d.header) push(CMD.boldOn, ...line(d.header), CMD.boldOff)
  push(CMD.doubleOn, CMD.boldOn, ...line(d.businessName.toUpperCase()), CMD.boldOff, CMD.doubleOff)
  if (d.branchName)  push(...line(d.branchName))
  if (d.businessNit) push(...line(`NIT: ${d.businessNit}`))
  if (d.address)     push(...line(d.address))
  if (d.phone)       push(...line(`Tel: ${d.phone}`))
  push(CMD.boldOn, ...line('* FACTURA DE VENTA *'), CMD.boldOff)

  // ── Datos de la venta ──────────────────────────────────────
  push(CMD.alignLeft)
  push(...sep('=', W))
  push(...line(`No.   : ${d.orderNumber}`))
  push(...line(`Fecha : ${d.date}`))
  if (d.waiterName)  push(...line(`Mesero: ${d.waiterName}`))
  if (d.cashierName) push(...line(`Cajero: ${d.cashierName}`))
  push(...sep('=', W))

  // ── Cliente ────────────────────────────────────────────────
  push(CMD.boldOn, ...line('CLIENTE:'), CMD.boldOff)
  if (d.customerName) {
    push(...line(`  ${d.customerName}`))
    if (d.customerDocId) push(...line(`  CC/NIT: ${d.customerDocId}`))
    if (d.customerPhone) push(...line(`  Tel: ${d.customerPhone}`))
  } else {
    push(...line('  Consumidor final'))
    push(...line('  CC/NIT: 222222222222'))
  }
  push(...sep('=', W))

  // ── Ítems ──────────────────────────────────────────────────
  push(CMD.boldOn, ...line(padRight('DESCRIPCION', W - 10) + padLeft('TOTAL', 10)), CMD.boldOff)
  push(...sep('-', W))
  for (const item of d.items) {
    push(...itemLine(item.name, item.quantity, item.unitPrice, item.total, W))
  }
  push(...sep('-', W))

  // ── Totales ────────────────────────────────────────────────
  push(...row('Subtotal (sin IVA)', formatMoney(d.subtotal - d.taxTotal), W))
  if (d.discountTotal > 0) {
    push(...row('Descuento', `-${formatMoney(d.discountTotal)}`, W))
  }
  if (d.taxTotal > 0) {
    if (d.taxBase != null) push(...row('Base gravable', formatMoney(d.taxBase), W))
    push(...row('IVA', formatMoney(d.taxTotal), W))
  } else {
    push(...row('IVA', `${formatMoney(0)} (Excluido)`, W))
  }
  if (d.tip && d.tip > 0) {
    push(...row('Propina voluntaria', formatMoney(d.tip), W))
  }
  push(...sep('-', W))
  push(CMD.boldOn, CMD.wideOn)
  push(...row('TOTAL', formatMoney(d.total), Math.floor(W / 2)))
  push(CMD.wideOff, CMD.boldOff)
  push(...sep('=', W))

  // ── Forma de pago ──────────────────────────────────────────
  push(CMD.boldOn, ...line('FORMA DE PAGO:'), CMD.boldOff)
  for (const p of d.payments) {
    const label = METHOD_LABEL[p.method] ?? p.method
    push(...row(`  ${label}`, formatMoney(p.amount), W))
  }
  if (d.cashReceived && d.cashReceived > 0) {
    push(...row('  Efectivo recibido', formatMoney(d.cashReceived), W))
  }
  if (d.change && d.change > 0) {
    push(...row('  Cambio entregado', formatMoney(d.change), W))
  }

  // ── Pie ────────────────────────────────────────────────────
  push(...sep('-', W))
  push(CMD.alignCenter)
  push(...line('Regimen Comun - Responsable IVA'))
  push(...line('Esta factura es titulo valor'))
  push(...line('segun Art. 616-1 E.T.'))
  push(...line())
  push(CMD.boldOn, ...line('¡Gracias por su compra!'), CMD.boldOff)
  push(...line('Conserve esta factura'))
  if (d.footer) push(...line(d.footer))
  push(...line('www.reg-x.com'))

  // Avanzar y cortar
  push(...CMD.feedCut)

  return new Uint8Array(bytes)
}

/** Convierte Uint8Array a base64 para enviar por HTTP */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}
