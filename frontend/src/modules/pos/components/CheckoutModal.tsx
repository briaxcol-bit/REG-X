import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Banknote, CreditCard, Smartphone, Gift, CheckCircle2, Printer } from 'lucide-react'
import { usePOSStore } from '@store/pos.store'
import { formatCurrency } from '@shared/utils/format'
import { cn } from '@shared/utils/cn'
import { useCreateSale } from '@modules/pos/hooks/useCreateSale'

type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'QR' | 'GIFT_CARD'

interface PaymentMethodOption {
  method: PaymentMethod
  label: string
  icon: React.ElementType
  color: string
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  { method: 'CASH',      label: 'Efectivo',     icon: Banknote,    color: 'text-green-400 bg-green-400/10' },
  { method: 'CARD',      label: 'Tarjeta',      icon: CreditCard,  color: 'text-blue-400 bg-blue-400/10' },
  { method: 'TRANSFER',  label: 'Transferencia',icon: Smartphone,  color: 'text-purple-400 bg-purple-400/10' },
  { method: 'QR',        label: 'QR / Billetera',icon: Smartphone, color: 'text-cyan-400 bg-cyan-400/10' },
  { method: 'GIFT_CARD', label: 'Gift Card',    icon: Gift,        color: 'text-yellow-400 bg-yellow-400/10' },
]

interface CheckoutModalProps {
  open: boolean
  onClose: () => void
  total: number
  currency: string
}

export function CheckoutModal({ open, onClose, total, currency }: CheckoutModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('CASH')
  const [cashInput, setCashInput] = useState('')
  const [success, setSuccess] = useState(false)

  const { items, discounts, customerId, tableId, notes, clearCart, addPayment, payments } = usePOSStore()
  const { mutateAsync: createSale, isPending } = useCreateSale()

  const cashReceived = parseInt(cashInput.replace(/\D/g, ''), 10) || 0
  const change = Math.max(0, cashReceived - total)
  const canComplete = selectedMethod !== 'CASH' || cashReceived >= total

  const handleComplete = async () => {
    try {
      addPayment({ method: selectedMethod, amount: selectedMethod === 'CASH' ? cashReceived : total })

      await createSale({
        items: items.map((it) => ({
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
        payments: [...payments, { method: selectedMethod, amount: selectedMethod === 'CASH' ? cashReceived : total }],
        customer_id:    customerId,
        notes,
        subtotal:       items.reduce((s, it) => s + it.price * it.quantity, 0),
        tax_total:      items.reduce((s, it) => s + it.taxAmount, 0),
        discount_total: items.reduce((s, it) => s + it.discountAmount, 0),
        total,
        currency,
      })

      setSuccess(true)
      setTimeout(() => {
        clearCart()
        setSuccess(false)
        setCashInput('')
        onClose()
      }, 2000)
    } catch {
      // Error handled by mutation onError
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={onClose}
          >
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 shadow-2xl custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
            {success ? (
              // ── Success state ──────────────────────────
              <div className="flex flex-col items-center gap-4 p-10">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/15"
                >
                  <CheckCircle2 className="h-10 w-10 text-green-400" />
                </motion.div>
                <h3 className="text-xl font-bold text-grafito-900 dark:text-white">¡Venta completada!</h3>
                <p className="text-grafito-500 dark:text-grafito-400">
                  {formatCurrency(total, currency)} cobrado exitosamente
                </p>
                {change > 0 && (
                  <div className="rounded-xl bg-green-500/10 px-6 py-3 text-center">
                    <p className="text-xs text-grafito-500 dark:text-grafito-400">Cambio</p>
                    <p className="text-2xl font-bold text-green-400">{formatCurrency(change, currency)}</p>
                  </div>
                )}
                <button className="flex items-center gap-2 rounded-lg bg-grafito-100 dark:bg-grafito-800 px-4 py-2 text-sm text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors">
                  <Printer className="h-4 w-4" /> Imprimir recibo
                </button>
              </div>
            ) : (
              <>
                {/* ── Header ────────────────────────────── */}
                <div className="flex items-center justify-between border-b border-grafito-200 dark:border-white/5 p-6">
                  <div>
                    <h3 className="text-lg font-semibold text-grafito-900 dark:text-white">Cobrar venta</h3>
                    <p className="text-2xl font-bold text-brand-400 mt-0.5">
                      {formatCurrency(total, currency)}
                    </p>
                  </div>
                  <button onClick={onClose} className="rounded-lg p-2 text-grafito-500 dark:text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  {/* Payment methods */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {PAYMENT_METHODS.map(({ method, label, icon: Icon, color }) => (
                      <button
                        key={method}
                        onClick={() => setSelectedMethod(method)}
                        className={cn(
                          'flex flex-col items-center gap-1.5 rounded-xl p-3 border transition-all',
                          selectedMethod === method
                            ? 'border-brand-500 bg-brand-500/10'
                            : 'border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 hover:border-white/20',
                        )}
                      >
                        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-medium text-grafito-900 dark:text-white">{label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Cash input */}
                  {selectedMethod === 'CASH' && (
                    <div className="space-y-3">
                      <label className="text-sm text-grafito-500 dark:text-grafito-400">Efectivo recibido</label>
                      <input
                        type="text"
                        value={cashInput}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, '')
                          if (!raw) return setCashInput('')
                          setCashInput(new Intl.NumberFormat('es-CO').format(parseInt(raw, 10)))
                        }}
                        placeholder={formatCurrency(total, currency)}
                        className="w-full rounded-xl bg-grafito-100 dark:bg-grafito-800 border border-grafito-200 dark:border-white/10 px-4 py-3 text-xl font-bold text-grafito-900 dark:text-white placeholder:text-grafito-400 dark:placeholder:text-grafito-600 outline-none focus:border-brand-500"
                        autoFocus
                      />
                      {/* Quick amounts */}
                      <div className="grid grid-cols-4 gap-2">
                        {[total, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100]
                          .filter((v, i, a) => a.indexOf(v) === i)
                          .map((amount) => (
                            <button
                              key={amount}
                              onClick={() => setCashInput(new Intl.NumberFormat('es-CO').format(amount))}
                              className="rounded-lg bg-grafito-100 dark:bg-grafito-800 py-2 text-xs font-medium text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors border border-grafito-200 dark:border-white/5"
                            >
                              {formatCurrency(amount, currency)}
                            </button>
                          ))}
                      </div>
                      {cashReceived > 0 && (
                        <div className="flex items-center justify-between rounded-xl bg-grafito-100 dark:bg-grafito-800 px-4 py-3">
                          <span className="text-sm text-grafito-500 dark:text-grafito-400">Cambio</span>
                          <span className={cn('text-lg font-bold', change > 0 ? 'text-green-400' : 'text-red-400')}>
                            {formatCurrency(change, currency)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Confirm */}
                <div className="border-t border-grafito-200 dark:border-white/5 p-6">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleComplete}
                    disabled={!canComplete || isPending}
                    className={cn(
                      'flex w-full items-center justify-center gap-2 rounded-xl py-4 font-bold text-base transition-all',
                      canComplete && !isPending
                        ? 'bg-brand-500 text-grafito-900 dark:text-white hover:bg-brand-600'
                        : 'bg-grafito-100 dark:bg-grafito-800 text-grafito-600 cursor-not-allowed',
                    )}
                  >
                    {isPending ? (
                      <span className="flex items-center gap-2">
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                        />
                        Procesando…
                      </span>
                    ) : (
                      <><CheckCircle2 className="h-5 w-5" /> Confirmar cobro</>
                    )}
                  </motion.button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
