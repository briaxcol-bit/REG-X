import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Banknote, CreditCard, Smartphone, CheckCircle2, Printer, ChevronRight, RotateCcw, CircleDollarSign, Gift } from 'lucide-react'
import { toast } from 'sonner'
import { usePOSStore } from '@store/pos.store'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import { cn } from '@shared/utils/cn'
import { useCreateSale } from '@modules/pos/hooks/useCreateSale'
import { useCashSession } from '@modules/pos/hooks/useCashSession'
import { ReceiptTemplate, type ReceiptData } from './ReceiptTemplate'
import { closeAllRestaurantOrdersForTable, getCustomerById, createTip, type CustomerRow } from '@lib/db'
import { openCashDrawer, linkCashDrawer, cashDrawerLinked, cashDrawerSupported, getCashDrawerBridgeUrl } from '@lib/cash-drawer'
import { buildEscPosReceipt, bytesToBase64 } from '@lib/escpos'
import { isUsbPrinterSupported, usbPrinterLinked, linkUsbPrinter, printUsbRaw, openDrawerUsb, usbAccessDenied, lastUsbError } from '@lib/usb-printer'

// ── Métodos de pago ────────────────────────────────────────────────────────────
type PaymentMethod = 'CASH' | 'CARD' | 'NEQUI' | 'DAVIPLATA' | 'TRANSFER' | 'CREDIT' | 'GIFT_CARD'

const METHODS: {
  method: PaymentMethod
  label: string
  sub: string
  color: string
  border: string
  bg: string
  icon: React.ElementType | string
}[] = [
  {
    method: 'CASH',
    label:  'Efectivo',
    sub:    'Billetes y monedas',
    color:  'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500',
    bg:     'bg-emerald-50 dark:bg-emerald-500/10',
    icon:   Banknote,
  },
  {
    method: 'CARD',
    label:  'Tarjeta',
    sub:    'Débito / Crédito',
    color:  'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500',
    bg:     'bg-blue-50 dark:bg-blue-500/10',
    icon:   CreditCard,
  },
  {
    method: 'NEQUI',
    label:  'Nequi',
    sub:    'Pago por app',
    color:  'text-purple-600 dark:text-purple-400',
    border: 'border-purple-500',
    bg:     'bg-purple-50 dark:bg-purple-500/10',
    icon:   '🟣',
  },
  {
    method: 'DAVIPLATA',
    label:  'Daviplata',
    sub:    'Pago por app',
    color:  'text-red-600 dark:text-red-400',
    border: 'border-red-500',
    bg:     'bg-red-50 dark:bg-red-500/10',
    icon:   '🔴',
  },
  {
    method: 'TRANSFER',
    label:  'Transferencia',
    sub:    'Bancolombia / PSE',
    color:  'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500',
    bg:     'bg-amber-50 dark:bg-amber-500/10',
    icon:   Smartphone,
  },
  {
    method: 'CREDIT',
    label:  'Fiado',
    sub:    'Cuenta por cobrar',
    color:  'text-orange-600 dark:text-orange-400',
    border: 'border-orange-500',
    bg:     'bg-orange-50 dark:bg-orange-500/10',
    icon:   CircleDollarSign,
  },
  {
    method: 'GIFT_CARD',
    label:  'Gift Card',
    sub:    'Redimir por código',
    color:  'text-pink-600 dark:text-pink-400',
    border: 'border-pink-500',
    bg:     'bg-pink-50 dark:bg-pink-500/10',
    icon:   Gift,
  },
]

// Denominaciones rápidas para efectivo
const QUICK_CASH = [5000, 10000, 20000, 50000, 100000]

interface CheckoutModalProps {
  open:                boolean
  onClose:             () => void
  total:               number   // grand total (incluye propina)
  tip?:                number
  currency:            string
  tableId?:            string
  restaurantOrderId?:  string
}

export function CheckoutModal({ open, onClose, total, tip = 0, currency, tableId, restaurantOrderId }: CheckoutModalProps) {
  const [method, setMethod]             = useState<PaymentMethod>('CASH')
  const [cashInput, setCashInput]       = useState('')
  const [giftCardCode, setGiftCardCode] = useState('')
  const [success, setSuccess]           = useState(false)
  const [customerData, setCustomerData] = useState<CustomerRow | null>(null)
  const [printMsg, setPrintMsg]         = useState('')  // estado visible de la última impresión

  const { tabs, activeTabId, clearCart, lastReceipt, setLastReceipt } = usePOSStore()
  const activeTab  = tabs.find(t => t.id === activeTabId) ?? tabs[0]
  const items      = activeTab?.items      ?? []
  const discounts  = activeTab?.discounts  ?? []
  const payments   = activeTab?.payments   ?? []
  const customerId  = activeTab?.customerId
  const waiterName  = activeTab?.waiterName
  const notes       = activeTab?.notes      ?? ''
  const { tenant, branch, profile } = useAuthStore()
  const { mutateAsync: createSale, isPending } = useCreateSale()
  const { activeRegister } = useCashSession()

  // Cargar datos del cliente cuando hay uno seleccionado
  useEffect(() => {
    if (!customerId) { setCustomerData(null); return }
    getCustomerById(customerId).then(setCustomerData)
  }, [customerId])

  const receipt = success ? lastReceipt : null

  const cashReceived = parseInt(cashInput.replace(/\D/g, ''), 10) || 0
  const change       = method === 'CASH' ? Math.max(0, cashReceived - total) : 0
  const canComplete  =
    method === 'CASH'      ? cashReceived >= total :
    method === 'CREDIT'    ? !!customerId :
    method === 'GIFT_CARD' ? giftCardCode.trim().length > 0 :
    true

  const handleCashInput = (raw: string) => {
    const digits = raw.replace(/\D/g, '')
    if (!digits) { setCashInput(''); return }
    setCashInput(new Intl.NumberFormat('es-CO').format(parseInt(digits, 10)))
  }

  const addQuickCash = (amount: number) => {
    const current = parseInt(cashInput.replace(/\D/g, ''), 10) || 0
    setCashInput(new Intl.NumberFormat('es-CO').format(current + amount))
  }

  const handleComplete = async () => {
    try {
      // Siempre guardamos el total de la venta como monto del pago.
      // Para efectivo, cashReceived > total es el vuelto — sale de caja pero no es ingreso.
      const paidAmount   = total
      const subtotalAmt  = items.reduce((s, it) => s + it.price * it.quantity, 0)
      const taxTotalAmt  = items.reduce((s, it) => s + it.taxAmount, 0)
      const discountAmt  = items.reduce((s, it) => s + it.discountAmount, 0)
      // El total de la venta (sin propina) — la propina se anota en notas
      const saleTotal    = total - tip

      const createdSale = await createSale({
        items: items.map(it => ({
          product_id:      it.productId,
          name:            it.name,
          sku:             it.sku,
          quantity:        it.quantity,
          unit_price:      it.price,
          discount:        it.discount,
          discount_amount: it.discountAmount,
          tax:             it.tax,
          tax_amount:      it.taxAmount,
          total:           it.total,
        })),
        payments: [{
          method:    method === 'NEQUI' || method === 'DAVIPLATA' ? 'QR' : method,
          amount:    paidAmount,
          reference: method === 'GIFT_CARD' ? giftCardCode.trim().toUpperCase() : undefined,
        }],
        customer_id:      customerId,
        notes:            tip > 0 ? `${notes ? notes + ' | ' : ''}Propina: ${tip}` : notes,
        subtotal:         subtotalAmt,
        tax_total:        taxTotalAmt,
        discount_total:   discountAmt,
        total:             saleTotal,
        currency,
        cash_register_id:  activeRegister?.id,
        // Órdenes de restaurante: la comida ya fue preparada — no bloquear por stock insuficiente.
        // Usamos tableId (siempre presente en tabs de mesa) en lugar de restaurantOrderId
        // que puede ser undefined cuando hay múltiples comandas activas.
        skip_stock_check:  !!(tableId || restaurantOrderId),
      })

      // Abrir el cajón monedero en ventas en efectivo (silencioso si no está vinculado)
      if (method === 'CASH') {
        if (await usbPrinterLinked()) openDrawerUsb().catch(() => {})
        else openCashDrawer().catch(() => {})
      }

      // Registrar la propina como dato real (además de la nota) para el módulo de Propinas
      if (tip > 0 && tenant?.tenantId) {
        try {
          await createTip(tenant.tenantId, {
            amount:    tip,
            sale_id:   (createdSale as any)?.id ?? null,
            waiter_id: profile?.id ?? null,
            branch_id: branch?.branchId ?? null,
          })
        } catch (e) {
          console.warn('No se pudo registrar la propina:', e)
        }
      }

      // Cerrar TODAS las órdenes activas de la mesa y liberarla
      if (tableId && tenant?.tenantId) {
        try {
          await closeAllRestaurantOrdersForTable(tenant.tenantId, tableId)
        } catch (e) {
          console.warn('No se pudo cerrar las órdenes de restaurante:', e)
        }
      }

      // Avisar productos que quedan agotados tras la venta
      // (solo en ventas normales — en mesas el stock puede no reflejar la realidad)
      if (!tableId) {
        const agotados = items.filter(it => it.stock - it.quantity <= 0)
        agotados.forEach(it => {
          toast.warning(`"${it.name}" quedó agotado en inventario.`, { duration: 5000 })
        })
      }

      const taxBaseAmt       = subtotalAmt - discountAmt

      const customerReceipt = customerData
        ? { name: customerData.full_name, docId: customerData.tax_id ?? undefined, phone: customerData.phone ?? undefined }
        : undefined

      setLastReceipt({
        businessName:   tenant?.tenantName ?? 'Mi Negocio',
        branchName:     branch?.branchName ?? '',
        nit:            '000.000.000-0',
        orderNumber:    `ORD-${Date.now().toString(36).toUpperCase()}`,
        cashierName:    profile?.fullName ?? 'Cajero',
        waiterName:     waiterName,
        date:           new Date(),
        customer:       customerReceipt,
        items: items.map(it => ({
          name:     it.name,
          qty:      it.quantity,
          price:    it.price,
          total:    it.total,
          discount: it.discountAmount,
          tax:      it.tax,
          taxAmt:   it.taxAmount,
          notes:    it.notes,
        })),
        subtotal:       subtotalAmt,
        discountTotal:  discountAmt,
        taxBase:        taxBaseAmt,
        taxTotal:       taxTotalAmt,
        tip:            tip > 0 ? tip : undefined,
        total,
        paymentMethod:  METHODS.find(m => m.method === method)?.label ?? method,
        cashReceived:   method === 'CASH' ? cashReceived : undefined,
        change:         method === 'CASH' ? change : undefined,
        currency,
      })
      setSuccess(true)
    } catch {
      // handled by mutation
    }
  }

  const handlePrint = async () => {
    if (!lastReceipt) return
    const r = lastReceipt

    // ── Impresión directa ESC/POS (sin diálogo) ──────────────
    const escBytes = buildEscPosReceipt({
      businessName:  r.businessName,
      orderNumber:   r.orderNumber,
      cashierName:   r.cashierName,
      waiterName:    r.waiterName,
      customerName:  r.customer?.name,
      date:          r.date.toLocaleString('es-CO'),
      items: r.items.map(it => ({
        name:      it.name,
        quantity:  it.qty,
        unitPrice: it.price,
        total:     it.total,
      })),
      subtotal:      r.subtotal,
      taxTotal:      r.taxTotal,
      discountTotal: r.discountTotal,
      total:         r.total,
      payments: [{ method: r.paymentMethod, amount: r.total }],
      change:        r.change,
    })

    // 1) USB directo — funciona en tablet/móvil Android (imprime sin driver del SO).
    //    En PC Windows el SO niega el USB ("Access denied"); ahí se marca
    //    usbAccessDenied() y caemos al diálogo del navegador (que usa el driver
    //    de Windows ya instalado). No dependemos del userAgent: algunos POS
    //    Android no se identifican como "móvil".
    setPrintMsg('▶ Imprimiendo… USB=' + isUsbPrinterSupported() + ' denegado=' + usbAccessDenied())

    if (isUsbPrinterSupported() && !usbAccessDenied()) {
      let linked = await usbPrinterLinked()
      if (!linked) {
        // Abrir el selector USB de Chrome (requiere el gesto de este click).
        linked = await linkUsbPrinter()
      }
      if (!linked) {
        setPrintMsg('✗ No se seleccionó impresora (¿cancelaste el selector?)')
      } else {
        const ok = await printUsbRaw(escBytes)
        if (ok) { setPrintMsg('✓ Enviado por USB — ' + escBytes.length + ' bytes'); return }
        setPrintMsg('✗ USB: ' + (lastUsbError() || 'error desconocido'))
        // En tablet paramos aquí para poder leer el error. En PC (acceso negado)
        // dejamos que caiga al diálogo del navegador de más abajo.
        if (!usbAccessDenied()) return
      }
    }

    // 2) Intentar bridge de red (impresora por Ethernet)
    const bridgeUrl = getCashDrawerBridgeUrl()
    if (bridgeUrl) {
      try {
        const res = await fetch(`${bridgeUrl}/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: bytesToBase64(escBytes) }),
          signal: AbortSignal.timeout(5000),
        })
        if (res.ok) return
      } catch { /* cae al navegador */ }
    }
    const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: r.currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
    const dateStr = r.date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const timeStr = r.date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

    const customerBlock = r.customer
      ? '<div style="padding-left:6px">' + r.customer.name + '</div>'
        + (r.customer.docId ? '<div style="padding-left:6px">CC/NIT: ' + r.customer.docId + '</div>' : '')
        + (r.customer.phone ? '<div style="padding-left:6px">Tel: ' + r.customer.phone + '</div>' : '')
      : '<div style="padding-left:6px">Consumidor final</div><div style="padding-left:6px">CC/NIT: 222222222222</div>'

    const itemRows = r.items.map(it => `
      <tr>
        <td style="padding:3px 0;vertical-align:top">
          <div>${it.name}</div>
          <div>${it.qty} und × ${fmt(it.price)}${it.tax > 0 ? ' · IVA ' + it.tax + '%' : ''}</div>
          ${it.notes ? '<div style="padding-left:8px">* ' + it.notes + '</div>' : ''}
          ${it.discount > 0 ? '<div>Desc: -' + fmt(it.discount) + '</div>' : ''}
        </td>
        <td style="padding:3px 0;text-align:right;vertical-align:top;width:30%">${fmt(it.total)}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Recibo ${r.orderNumber}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box;
      -webkit-font-smoothing:none; font-smooth:never;
      text-rendering:optimizeSpeed; font-synthesis:none; }
  body {
    font-family:'Courier New',Courier,monospace;
    font-size:12px; font-weight:900;
    width:72mm; padding:2mm 0 0;
    color:#000000; background:#ffffff;
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
    word-break:break-word;
  }
  .center { text-align:center; }
  .bold   { font-weight:900; }
  .sep-solid { border:none; border-top:2px solid #000; margin:5px 0; }
  .sep-dot   { border:none; border-top:1px dashed #000; margin:4px 0; }
  table { width:100%; border-collapse:collapse; table-layout:fixed; }
  td { font-size:12px; font-weight:900; word-break:break-word; }
  .row-total td { font-weight:900; font-size:13px; border-top:2px solid #000; padding-top:4px; }
  @media print {
    @page { size:80mm auto; margin:0 4mm; }
    body  { width:72mm; filter:contrast(999); }
  }
</style>
</head><body>
  <div class="center bold" style="font-size:15px">${r.businessName.toUpperCase()}</div>
  ${r.branchName ? '<div class="center">' + r.branchName + '</div>' : ''}
  <div class="center">NIT: ${r.nit}</div>
  <div class="center bold" style="margin:4px 0">* FACTURA DE VENTA *</div>
  <hr class="sep-solid">
  <div>No.: ${r.orderNumber}</div>
  <div>Fecha: ${dateStr} ${timeStr}</div>
  ${r.waiterName ? '<div>Mesero: ' + r.waiterName + '</div>' : ''}
  <div>Cajero: ${r.cashierName}</div>
  <hr class="sep-solid">
  <div class="bold">CLIENTE:</div>
  ${customerBlock}
  <hr class="sep-solid">
  <table>
    <thead><tr>
      <th style="text-align:left;padding-bottom:3px">DESCRIPCIÓN</th>
      <th style="text-align:right;padding-bottom:3px">TOTAL</th>
    </tr></thead>
    <hr class="sep-dot">
    <tbody>${itemRows}</tbody>
  </table>
  <hr class="sep-dot">
  <table style="margin-top:4px">
    <tr><td>Subtotal (sin IVA)</td><td style="text-align:right">${fmt(r.subtotal - r.taxTotal)}</td></tr>
    ${r.discountTotal > 0 ? '<tr><td>Descuento</td><td style="text-align:right">-' + fmt(r.discountTotal) + '</td></tr>' : ''}
    ${r.taxTotal > 0 ? '<tr><td>Base gravable</td><td style="text-align:right">' + fmt(r.taxBase) + '</td></tr><tr><td>IVA</td><td style="text-align:right">' + fmt(r.taxTotal) + '</td></tr>' : '<tr><td>IVA</td><td style="text-align:right">' + fmt(0) + ' (Excluido)</td></tr>'}
    ${r.tip ? '<tr><td>Propina voluntaria</td><td style="text-align:right">' + fmt(r.tip) + '</td></tr>' : ''}
    <tr class="row-total"><td>TOTAL A PAGAR</td><td style="text-align:right">${fmt(r.total)}</td></tr>
  </table>
  <hr class="sep-solid">
  <div class="bold">FORMA DE PAGO:</div>
  <table>
    <tr><td style="padding-left:6px">${r.paymentMethod}</td><td style="text-align:right">${fmt(r.total)}</td></tr>
    ${r.cashReceived ? '<tr><td style="padding-left:6px">Efectivo recibido</td><td style="text-align:right">' + fmt(r.cashReceived) + '</td></tr>' : ''}
    ${r.change ? '<tr><td style="padding-left:6px">Cambio entregado</td><td style="text-align:right">' + fmt(r.change) + '</td></tr>' : ''}
  </table>
  <hr class="sep-dot" style="margin-top:8px">
  <div class="center" style="margin-top:6px">Régimen Común — Responsable IVA</div>
  <div class="center" style="margin-top:4px">Esta factura es título valor según Art. 616-1 E.T.</div>
  <div class="center bold" style="margin-top:8px">¡Gracias por su compra!</div>
  <div class="center">Conserve esta factura</div>
  <div class="center" style="margin-top:6px">www.reg-x.com</div>
</body></html>`
    // iframe oculto — funciona en Android sin necesitar popups
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;'
    document.body.appendChild(iframe)
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document
    if (!doc) { document.body.removeChild(iframe); return }
    doc.open(); doc.write(html); doc.close()
    setTimeout(() => {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }, 300)
  }

  const handleNewSale = () => {
    clearCart()
    setSuccess(false)
    setCashInput('')
    setGiftCardCode('')
    setMethod('CASH')
    setPrintMsg('')
    onClose()
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:hidden"
            onClick={receipt ? undefined : onClose}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* ── SUCCESS STATE ─────────────────────────── */}
              {receipt ? (
                <div className="p-6 space-y-5">
                  {/* Checkmark */}
                  <div className="flex flex-col items-center gap-3 pt-4">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                      className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10"
                    >
                      <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                    </motion.div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-grafito-900 dark:text-white">¡Venta completada!</p>
                      <p className="text-2xl font-black text-brand-500 mt-1">{formatCurrency(total, currency)}</p>
                    </div>
                  </div>

                  {/* Cambio */}
                  {change > 0 && (
                    <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-4 text-center">
                      <p className="text-xs text-grafito-500 mb-1">Cambio a entregar</p>
                      <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(change, currency)}</p>
                    </div>
                  )}

                  {/* Resumen rápido */}
                  <div className="rounded-xl bg-grafito-50 dark:bg-white/5 divide-y divide-grafito-100 dark:divide-white/5">
                    {receipt.items.map((it, i) => (
                      <div key={i} className="flex justify-between px-4 py-2.5 text-sm">
                        <span className="text-grafito-600 dark:text-grafito-300">{it.qty}× {it.name}</span>
                        <span className="font-semibold text-grafito-900 dark:text-white">{formatCurrency(it.total, currency)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-sm font-bold text-grafito-900 dark:text-white">Total</span>
                      <span className="text-sm font-black text-brand-500">{formatCurrency(total, currency)}</span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5 text-xs text-grafito-500">
                      <span>Método de pago</span>
                      <span className="font-semibold">{receipt.paymentMethod}</span>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-3">
                    <button
                      onClick={async () => {
                        // USB (impresora conectada por USB al dispositivo)
                        if (isUsbPrinterSupported()) {
                          if (await usbPrinterLinked()) { openDrawerUsb(); return }
                          if (await linkUsbPrinter()) {
                            const ok = await openDrawerUsb()
                            toast[ok ? 'success' : 'error'](ok
                              ? 'Impresora vinculada — cajón y recibos por USB'
                              : 'No se pudo abrir el cajón')
                            return
                          }
                        }
                        // Serial (USB-Serie)
                        if (cashDrawerSupported()) {
                          if (await cashDrawerLinked()) { openCashDrawer(); return }
                          if (await linkCashDrawer()) {
                            const ok = await openCashDrawer()
                            toast[ok ? 'success' : 'error'](ok ? 'Cajón vinculado' : 'No se pudo abrir')
                          }
                        }
                      }}
                      title="Abrir cajón monedero"
                      className="flex items-center justify-center gap-2 rounded-xl border border-grafito-200 dark:border-white/10 px-4 py-3 text-sm font-semibold text-grafito-700 dark:text-grafito-200 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <CircleDollarSign className="h-4 w-4" />
                      Cajón
                    </button>
                    <button
                      onClick={handlePrint}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-grafito-200 dark:border-white/10 py-3 text-sm font-semibold text-grafito-700 dark:text-grafito-200 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <Printer className="h-4 w-4" />
                      Imprimir
                    </button>
                    <button
                      onClick={handleNewSale}
                      className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600 transition-colors"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Nueva venta
                    </button>
                  </div>

                  {/* Estado de impresión (diagnóstico visible) */}
                  {printMsg && (
                    <div className="mt-3 rounded-lg border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 px-3 py-2 text-xs font-mono text-grafito-700 dark:text-grafito-200 break-words">
                      {printMsg}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* ── HEADER ───────────────────────────── */}
                  <div className="flex items-center justify-between border-b border-grafito-100 dark:border-white/5 px-6 py-4">
                    <div>
                      <p className="text-xs text-grafito-500 font-medium uppercase tracking-wider">Cobrar</p>
                      <p className="text-3xl font-black text-grafito-900 dark:text-white mt-0.5">
                        {formatCurrency(total, currency)}
                      </p>
                    </div>
                    <button onClick={onClose} className="rounded-xl p-2 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="p-5 space-y-5">
                    {/* ── MÉTODOS DE PAGO ─────────────────── */}
                    <div>
                      <p className="text-xs font-bold text-grafito-500 uppercase tracking-wider mb-3">Método de pago</p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {METHODS.map(m => {
                          const active = method === m.method
                          const IconEl = m.icon
                          return (
                            <button
                              key={m.method}
                              onClick={() => setMethod(m.method)}
                              className={cn(
                                'flex flex-col items-center gap-1.5 rounded-xl p-3 border-2 transition-all',
                                active
                                  ? `${m.border} ${m.bg}`
                                  : 'border-grafito-200 dark:border-white/5 bg-grafito-50 dark:bg-white/[0.02] hover:border-grafito-300 dark:hover:border-white/10'
                              )}
                            >
                              <div className={cn(
                                'flex h-8 w-8 items-center justify-center rounded-lg text-lg',
                                active ? m.bg : 'bg-grafito-100 dark:bg-white/5'
                              )}>
                                {typeof IconEl === 'string'
                                  ? <span className="text-base leading-none">{IconEl}</span>
                                  : <IconEl className={cn('h-4 w-4', active ? m.color : 'text-grafito-400')} />
                                }
                              </div>
                              <span className={cn('text-[10px] font-bold leading-tight text-center', active ? m.color : 'text-grafito-500 dark:text-grafito-400')}>
                                {m.label}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* ── EFECTIVO ────────────────────────── */}
                    {method === 'CASH' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-3"
                      >
                        <p className="text-xs font-bold text-grafito-500 uppercase tracking-wider">Efectivo recibido</p>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-grafito-400 font-bold text-lg">$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={cashInput}
                            onChange={e => handleCashInput(e.target.value)}
                            placeholder={new Intl.NumberFormat('es-CO').format(total)}
                            autoFocus
                            className="w-full rounded-xl border-2 border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 pl-8 pr-4 py-3.5 text-2xl font-black text-grafito-900 dark:text-white placeholder-grafito-300 dark:placeholder-grafito-600 outline-none focus:border-brand-500 transition-colors"
                          />
                        </div>

                        {/* Denominaciones rápidas */}
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => setCashInput(new Intl.NumberFormat('es-CO').format(total))}
                            className="rounded-lg bg-brand-500/10 border border-brand-500/30 px-3 py-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:bg-brand-500/20 transition-colors"
                          >
                            Exacto
                          </button>
                          {QUICK_CASH.filter(v => v > total * 0.8).slice(0, 4).map(v => (
                            <button
                              key={v}
                              onClick={() => addQuickCash(v)}
                              className="rounded-lg bg-grafito-100 dark:bg-white/5 border border-grafito-200 dark:border-white/10 px-3 py-1.5 text-xs font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-white/10 transition-colors"
                            >
                              +{new Intl.NumberFormat('es-CO').format(v)}
                            </button>
                          ))}
                        </div>

                        {/* Cambio */}
                        <div className={cn(
                          'flex items-center justify-between rounded-xl px-5 py-4 transition-colors',
                          change > 0
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20'
                            : 'bg-grafito-100 dark:bg-white/5 border border-grafito-200 dark:border-white/5'
                        )}>
                          <span className="text-sm text-grafito-500">Cambio</span>
                          <span className={cn(
                            'text-2xl font-black',
                            change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-grafito-400'
                          )}>
                            {formatCurrency(change, currency)}
                          </span>
                        </div>
                      </motion.div>
                    )}

                    {/* ── INFO MÉTODOS DIGITALES ────────── */}
                    {(method === 'NEQUI' || method === 'DAVIPLATA') && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl bg-grafito-50 dark:bg-white/5 border border-grafito-200 dark:border-white/10 p-4 text-center space-y-2"
                      >
                        <p className="text-xs text-grafito-500">Solicita al cliente transferir a</p>
                        <p className="text-lg font-black text-grafito-900 dark:text-white">{formatCurrency(total, currency)}</p>
                        <p className="text-xs text-grafito-400">vía {method === 'NEQUI' ? 'Nequi' : 'Daviplata'} y confirma el pago antes de continuar</p>
                      </motion.div>
                    )}

                    {(method === 'CARD' || method === 'TRANSFER') && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl bg-grafito-50 dark:bg-white/5 border border-grafito-200 dark:border-white/10 p-4 text-center"
                      >
                        <p className="text-xs text-grafito-500 mb-1">
                          {method === 'CARD' ? 'Pasa la tarjeta por el datáfono' : 'Confirma que la transferencia fue recibida'}
                        </p>
                        <p className="text-xl font-black text-grafito-900 dark:text-white">{formatCurrency(total, currency)}</p>
                      </motion.div>
                    )}

                    {method === 'CREDIT' && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 p-4 space-y-1"
                      >
                        {customerId ? (
                          <>
                            <p className="text-sm font-semibold text-grafito-900 dark:text-white">
                              Se creará una cuenta por cobrar {customerData ? `a ${customerData.full_name}` : 'al cliente'}
                            </p>
                            <p className="text-xs text-grafito-500">
                              Por {formatCurrency(total, currency)} · vence en 30 días · se gestiona en Finanzas → Cuentas por Cobrar
                            </p>
                          </>
                        ) : (
                          <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                            Para fiar debes seleccionar primero un cliente en el carrito
                          </p>
                        )}
                      </motion.div>
                    )}

                    {method === 'GIFT_CARD' && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl bg-pink-50 dark:bg-pink-500/10 border border-pink-200 dark:border-pink-500/20 p-4 space-y-2"
                      >
                        <p className="text-xs text-grafito-500">Código de la gift card</p>
                        <input
                          type="text"
                          value={giftCardCode}
                          onChange={e => setGiftCardCode(e.target.value)}
                          placeholder="GC-XXXXXXXX"
                          autoFocus
                          className="w-full rounded-lg border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 px-3 py-2.5 text-sm font-mono uppercase text-grafito-900 dark:text-white focus:border-pink-500 focus:outline-none"
                        />
                        <p className="text-xs text-grafito-400">
                          El saldo se valida y descuenta automáticamente al confirmar
                        </p>
                      </motion.div>
                    )}
                  </div>

                  {/* ── CONFIRM BUTTON ─────────────────── */}
                  <div className="border-t border-grafito-100 dark:border-white/5 p-5">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleComplete}
                      disabled={!canComplete || isPending}
                      className={cn(
                        'flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold transition-all',
                        canComplete && !isPending
                          ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-lg shadow-brand-500/20'
                          : 'bg-grafito-100 dark:bg-white/5 text-grafito-400 cursor-not-allowed'
                      )}
                    >
                      {isPending ? (
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white inline-block"
                        />
                      ) : (
                        <>
                          <CheckCircle2 className="h-5 w-5" />
                          Confirmar cobro
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </>
                      )}
                    </motion.button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
