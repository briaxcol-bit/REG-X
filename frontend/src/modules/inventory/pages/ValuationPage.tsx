import { useState, useEffect } from 'react'
import { DollarSign, Loader2, Package, TrendingUp } from 'lucide-react'
import { getInventory } from '@lib/db'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import { cn } from '@shared/utils/cn'
import type { InventoryRow } from '@lib/db'

export default function ValuationPage() {
  const { tenant, branch } = useAuthStore()
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!tenant?.tenantId || !branch?.branchId) return
    setLoading(true)
    getInventory(tenant.tenantId, branch.branchId)
      .then(setInventory)
      .catch(() => setInventory([]))
      .finally(() => setLoading(false))
  }, [tenant?.tenantId, branch?.branchId])

  let totalCost = 0
  let totalRetail = 0
  let totalItems = 0

  const itemsWithValuation = inventory.map(row => {
    const p = row.products as any
    const qty = Number(row.quantity)
    const cost = Number(p?.cost_price ?? 0)
    const price = Number(p?.price ?? 0)

    const rowCost = qty * cost
    const rowRetail = qty * price

    if (qty > 0) {
      totalCost += rowCost
      totalRetail += rowRetail
      totalItems += qty
    }

    return { ...row, p, qty, cost, price, rowCost, rowRetail }
  }).filter(i => i.qty > 0).sort((a, b) => b.rowRetail - a.rowRetail) // sort by highest retail value

  const potentialProfit = totalRetail - totalCost
  const margin = totalRetail > 0 ? (potentialProfit / totalRetail) * 100 : 0

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Valoración de Inventario</h1>
        <p className="text-sm text-grafito-500 dark:text-grafito-400">Análisis del capital invertido y ganancias potenciales.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-grafito-400 bg-white dark:bg-grafito-900/60 rounded-2xl border border-grafito-200 dark:border-white/5">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Calculando valoración...</span>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-5 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-2 text-grafito-500 dark:text-grafito-400">
                <Package className="h-4 w-4" />
                <h3 className="text-sm font-medium">Valor a Costo</h3>
              </div>
              <p className="text-2xl font-bold text-grafito-900 dark:text-white">{formatCurrency(totalCost)}</p>
              <p className="text-xs text-grafito-400 mt-1">Capital total invertido</p>
            </div>

            <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-5 backdrop-blur-md relative overflow-hidden">
              <div className="flex items-center gap-3 mb-2 text-brand-600 dark:text-brand-400">
                <DollarSign className="h-4 w-4" />
                <h3 className="text-sm font-medium">Valor a Precio de Venta</h3>
              </div>
              <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">{formatCurrency(totalRetail)}</p>
              <p className="text-xs text-brand-600/70 dark:text-brand-400/70 mt-1">{totalItems} unidades en stock</p>
            </div>

            <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-2 text-green-600 dark:text-green-400">
                <TrendingUp className="h-4 w-4" />
                <h3 className="text-sm font-medium">Ganancia Potencial</h3>
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(potentialProfit)}</p>
              <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">Margen global: {margin.toFixed(1)}%</p>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 backdrop-blur-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-grafito-600 dark:text-grafito-300">
                <thead className="bg-grafito-50 dark:bg-white/5 text-xs uppercase text-grafito-500 dark:text-grafito-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Producto</th>
                    <th className="px-4 py-3 font-medium text-right">Cantidad</th>
                    <th className="px-4 py-3 font-medium text-right">Costo U.</th>
                    <th className="px-4 py-3 font-medium text-right">Costo Total</th>
                    <th className="px-4 py-3 font-medium text-right">Precio U.</th>
                    <th className="px-4 py-3 font-medium text-right">Venta Total</th>
                    <th className="px-4 py-3 font-medium text-right">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
                  {itemsWithValuation.map((item) => {
                    const itemMargin = item.rowRetail > 0 ? ((item.rowRetail - item.rowCost) / item.rowRetail) * 100 : 0
                    return (
                      <tr key={item.id} className="hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-grafito-900 dark:text-white">{item.p?.name}</p>
                          <p className="text-xs text-grafito-400">SKU: {item.p?.sku || 'N/A'}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{item.qty}</td>
                        <td className="px-4 py-3 text-right text-grafito-500">{formatCurrency(item.cost)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(item.rowCost)}</td>
                        <td className="px-4 py-3 text-right text-grafito-500">{formatCurrency(item.price)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-grafito-900 dark:text-white">{formatCurrency(item.rowRetail)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn("text-xs font-medium px-2 py-1 rounded-md", itemMargin > 30 ? "bg-green-500/10 text-green-500" : itemMargin > 0 ? "bg-orange-500/10 text-orange-500" : "bg-red-500/10 text-red-500")}>
                            {itemMargin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {itemsWithValuation.length === 0 && (
              <div className="py-12 text-center text-sm text-grafito-400">
                No hay productos en inventario con cantidad mayor a cero.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
