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

function line(text: string): number[] {
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

function itemLine(name: string, qty: number, price: number, total: number, width = 32): number[] {
  const totalStr = formatMoney(total)
  const qtyPrice = `${qty}x${formatMoney(price)}`
  // Nombre truncado para que quede en una línea con el total
  const nameWidth = width - totalStr.length - 1
  const nameStr   = padRight(name, nameWidth)
  const result: number[] = line(`${nameStr} ${totalStr}`)
  // Si la cantidad/precio caben en la línea de nombre, bien; si no, segunda línea
  if (qtyPrice.length <= nameWidth) return result
  return [...line(`  ${qtyPrice}`), ...result]
}

function formatMoney(n: number): string {
  return `$${n.toLocaleString('es-CO')}`
}

// ── Interfaz pública ──────────────────────────────────────────
export interface EscPosReceiptData {
  businessName:  string
  businessNit?:  string
  address?:      string
  phone?:        string
  header?:       string
  footer?:       string
  orderNumber:   string
  cashierName?:  string
  customerName?: string
  waiterName?:   string
  date:          string
  items: {
    name:      string
    quantity:  number
    unitPrice: number
    total:     number
  }[]
  subtotal:       number
  taxTotal:       number
  discountTotal:  number
  total:          number
  payments: { method: string; amount: number }[]
  change?:        number
  /** Ancho de papel: 32 chars para 58mm, 48 chars para 80mm */
  paperWidth?: 32 | 48
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

  // Encabezado negocio
  push(CMD.alignCenter)
  if (d.header) push(CMD.boldOn, ...line(d.header), CMD.boldOff)
  push(CMD.doubleOn, CMD.boldOn, ...line(d.businessName), CMD.boldOff, CMD.doubleOff)
  if (d.businessNit) push(...line(`NIT: ${d.businessNit}`))
  if (d.address)     push(...line(d.address))
  if (d.phone)       push(...line(`Tel: ${d.phone}`))
  push(...line(''))

  // Datos de la venta
  push(CMD.alignLeft)
  push(...sep('-', W))
  push(...line(`Factura: ${d.orderNumber}`))
  push(...line(`Fecha  : ${d.date}`))
  if (d.cashierName)  push(...line(`Cajero : ${d.cashierName}`))
  if (d.waiterName)   push(...line(`Mesero : ${d.waiterName}`))
  if (d.customerName) push(...line(`Cliente: ${d.customerName}`))
  push(...sep('-', W))

  // Ítems
  push(CMD.boldOn, ...line(padRight('PRODUCTO', W - 10) + padLeft('TOTAL', 10)), CMD.boldOff)
  push(...sep('-', W))
  for (const item of d.items) {
    push(...itemLine(item.name, item.quantity, item.unitPrice, item.total, W))
  }
  push(...sep('-', W))

  // Totales
  const labelW = W - 12
  if (d.discountTotal > 0) {
    push(...line(padRight('Descuento', labelW) + padLeft(formatMoney(-d.discountTotal), 12)))
  }
  if (d.taxTotal > 0) {
    push(...line(padRight('IVA', labelW) + padLeft(formatMoney(d.taxTotal), 12)))
  }
  push(CMD.boldOn)
  push(...line(padRight('TOTAL', labelW) + padLeft(formatMoney(d.total), 12)))
  push(CMD.boldOff)
  push(...sep('-', W))

  // Pagos
  for (const p of d.payments) {
    const label = METHOD_LABEL[p.method] ?? p.method
    push(...line(padRight(label, labelW) + padLeft(formatMoney(p.amount), 12)))
  }
  if (d.change && d.change > 0) {
    push(...line(padRight('Cambio', labelW) + padLeft(formatMoney(d.change), 12)))
  }

  // Pie
  push(CMD.alignCenter)
  push(...line(''))
  push(CMD.boldOn, ...line('¡Gracias por su compra!'), CMD.boldOff)
  if (d.footer) push(...line(d.footer))
  push(...line('www.reg-x.com'))
  push(...line(''))

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
