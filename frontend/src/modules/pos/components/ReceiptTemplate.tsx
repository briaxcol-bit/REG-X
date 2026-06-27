/**
 * ReceiptTemplate — Factura de venta POS (80mm / 302px)
 * Formato completo con campos requeridos para Colombia.
 */

export interface ReceiptItem {
  name:     string
  qty:      number
  price:    number   // precio sin IVA
  total:    number   // total con IVA y descuentos
  discount: number   // monto descuento
  tax:      number   // porcentaje IVA
  taxAmt:   number   // monto IVA
}

export interface ReceiptCustomer {
  name:   string
  docId?: string
  phone?: string
}

export interface ReceiptData {
  // Negocio
  businessName:    string
  branchName:      string
  nit:             string
  address?:        string
  phone?:          string
  dianResolution?: string
  dianFrom?:       number
  dianTo?:         number
  // Venta
  orderNumber:     string
  cashierName:     string
  date:            Date
  customer?:       ReceiptCustomer
  // Items
  items:           ReceiptItem[]
  // Totales
  subtotal:        number
  discountTotal:   number
  taxBase:         number
  taxTotal:        number
  total:           number
  // Pago
  paymentMethod:   string
  cashReceived?:   number
  change?:         number
  currency:        string
  // Modo comanda (ticket simple, sin datos fiscales)
  isComanda?:      boolean
}

// ── Helpers ───────────────────────────────────────────────────

const W = 42

function lineChar(char = '─') { return char.repeat(W) }

function pad(left: string, right: string, width = W) {
  const space = width - left.length - right.length
  return left + ' '.repeat(Math.max(1, space)) + right
}

function center(text: string, width = W) {
  if (text.length >= width) return text.slice(0, width)
  const sp = width - text.length
  return ' '.repeat(Math.floor(sp / 2)) + text + ' '.repeat(Math.ceil(sp / 2))
}

function wrapText(text: string, width = W): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const candidate = cur ? cur + ' ' + w : w
    if (candidate.length <= width) {
      cur = candidate
    } else {
      if (cur) lines.push(cur)
      cur = w.length > width ? w.slice(0, width) : w
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function fmt(n: number, currency = 'COP') {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

// ── Component ─────────────────────────────────────────────────

export function ReceiptTemplate({ data }: { data: ReceiptData }) {
  const {
    businessName, branchName, nit, address, phone,
    dianResolution, dianFrom, dianTo,
    orderNumber, cashierName, date, customer,
    items, subtotal, discountTotal, taxBase, taxTotal, total,
    paymentMethod, cashReceived, change, currency,
    isComanda,
  } = data

  const dateStr = date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  const rows: string[] = []
  const push = (...ls: string[]) => rows.push(...ls)
  const nl = () => rows.push('')

  if (isComanda) {
    // ── TICKET COMANDA (simple, sin datos fiscales) ────────
    nl()
    push(center(businessName.toUpperCase()))
    if (branchName) push(center(branchName))
    nl()
    push(center('*** PEDIDO / COMANDA ***'))
    push(lineChar())
    push(`No.:   ${orderNumber}`)
    push(`Fecha: ${dateStr}  ${timeStr}`)
    if (cashierName) push(`Atendió: ${cashierName}`)
    if (customer) push(`Cliente: ${customer.name}`)
    push(lineChar())

    // Items — solo nombre, cantidad y total (sin precio unitario)
    push(pad('CANT  PRODUCTO', 'TOTAL'))
    push(lineChar('·'))
    for (const it of items) {
      const totalStr = fmt(it.total, currency)
      const prefix   = `${it.qty}x  `
      const maxName  = W - totalStr.length - prefix.length - 1
      const nameLines = wrapText(it.name, maxName)
      push(pad(prefix + nameLines[0], totalStr))
      for (let i = 1; i < nameLines.length; i++) push('     ' + nameLines[i])
      if (it.discount > 0) push(pad('     Desc:', `-${fmt(it.discount, currency)}`))
    }
    push(lineChar('·'))

    // Total
    nl()
    if (discountTotal > 0) push(pad('Descuento:', `-${fmt(discountTotal, currency)}`))
    push(lineChar())
    push(pad('TOTAL:', fmt(total, currency)))
    push(lineChar())
    nl()
    push(center('Este ticket NO es factura'))
    push(center('La factura se entrega al pagar'))
    nl()
    push(center('¡Gracias!'))
    nl()
    nl()
    nl()

  } else {
    // ── FACTURA DE VENTA completa ──────────────────────────
    // Agrupar IVA por tarifa
    const taxGroups: Record<number, { base: number; tax: number }> = {}
    for (const it of items) {
      if (it.tax > 0) {
        if (!taxGroups[it.tax]) taxGroups[it.tax] = { base: 0, tax: 0 }
        taxGroups[it.tax].base += it.price * it.qty
        taxGroups[it.tax].tax  += it.taxAmt
      }
    }

    // ENCABEZADO
    nl()
    push(center(businessName.toUpperCase()))
    push(center(branchName))
    push(center(`NIT: ${nit}`))
    if (address) wrapText(address, W).forEach(l => push(center(l)))
    if (phone)   push(center(`Tel: ${phone}`))
    nl()
    push(center('* FACTURA DE VENTA *'))
    if (dianResolution) {
      push(center(`Res. DIAN No. ${dianResolution}`))
      if (dianFrom && dianTo) push(center(`Del ${dianFrom.toLocaleString()} al ${dianTo.toLocaleString()}`))
    }
    push(lineChar())

    // DATOS
    push(`No.:    ${orderNumber}`)
    push(`Fecha:  ${dateStr}  ${timeStr}`)
    push(`Cajero: ${cashierName.length > 28 ? cashierName.slice(0, 27) + '…' : cashierName}`)
    push(lineChar())

    // CLIENTE
    push('CLIENTE:')
    if (customer) {
      push(`  ${customer.name}`)
      if (customer.docId) push(`  CC/NIT: ${customer.docId}`)
      if (customer.phone) push(`  Tel: ${customer.phone}`)
    } else {
      push('  Consumidor final')
      push('  CC/NIT: 222222222222')
    }
    push(lineChar())

    // ITEMS
    push(pad('DESCRIPCION', 'TOTAL'))
    push(lineChar('·'))
    for (const it of items) {
      const totalStr = fmt(it.total, currency)
      const nameLines = wrapText(it.name, W - totalStr.length - 1)
      push(pad(nameLines[0], totalStr))
      for (let i = 1; i < nameLines.length; i++) push(nameLines[i])
      const taxTag = it.tax > 0 ? `IVA ${it.tax}%` : 'Excl.'
      push(pad(`  ${it.qty} und x ${fmt(it.price, currency)}`, taxTag))
      if (it.discount > 0) push(pad('  Descuento:', `-${fmt(it.discount, currency)}`))
    }
    push(lineChar('·'))

    // TOTALES
    nl()
    push(pad('Subtotal (sin IVA):', fmt(subtotal - taxTotal, currency)))
    if (discountTotal > 0) push(pad('Descuento:', `-${fmt(discountTotal, currency)}`))

    const taxEntries = Object.entries(taxGroups)
    if (taxEntries.length > 0) {
      push(pad('Base gravable:', fmt(taxBase, currency)))
      for (const [rate, g] of taxEntries) {
        push(pad(`  IVA ${rate}%:`, fmt(g.tax, currency)))
      }
    } else {
      push(pad('IVA:', fmt(0, currency)))
      push(pad('  (Operación excluida)', ''))
    }

    push(lineChar())
    push(pad('TOTAL A PAGAR:', fmt(total, currency)))
    push(lineChar())
    nl()

    // PAGO
    push('FORMA DE PAGO:')
    push(pad(`  ${paymentMethod}`, fmt(total, currency)))
    if (cashReceived !== undefined && cashReceived > 0) {
      push(pad('  Efectivo recibido:', fmt(cashReceived, currency)))
      push(pad('  Cambio entregado:', fmt(change ?? 0, currency)))
    }

    nl()
    push(lineChar('·'))
    nl()

    // PIE LEGAL
    push(center('Régimen Común - Responsable IVA'))
    nl()
    push(center('Esta factura es título valor y presta'))
    push(center('mérito ejecutivo según el Art. 616-1 E.T.'))
    nl()
    push(center('¡Gracias por su compra!'))
    push(center('Conserve esta factura'))
    nl()
    push(center('www.reg-x.com'))
    nl()
    nl()
    nl()
  }

  return (
    <div
      style={{
        fontFamily: "'Courier New', Courier, monospace",
        fontSize:   '10.5px',
        lineHeight: '1.45',
        width:      '302px',
        padding:    '8px 4px 0',
        color:      '#000',
        background: '#fff',
        whiteSpace: 'pre',
      }}
    >
      {rows.join('\n')}
    </div>
  )
}
