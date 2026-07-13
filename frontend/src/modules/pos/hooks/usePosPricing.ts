import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@store/auth.store'
import { usePOSStore, type CartItem } from '@store/pos.store'
import { getPosPricingData, type PosPricingData, type PriceListItemRow } from '@lib/db'

/**
 * Conecta promociones y listas de precios con el carrito del POS.
 *
 * Reglas (en orden de prioridad):
 *  1. Lista de precios del CLIENTE seleccionado (tier de min_qty más alto que aplique)
 *  2. Listas VOLUME activas (aplican a todos, por cantidad)
 *  3. Promociones activas PERCENT / FIXED (por producto, categoría o todas)
 *
 * BOGO/COMBO no se aplican automáticamente (requieren interacción del cajero).
 */
export function usePosPricing() {
  const { tenant } = useAuthStore()
  const tenantId = tenant?.tenantId
  const { tabs, activeTabId, repriceItems } = usePOSStore()
  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0]
  const customerId = activeTab?.customerId
  const items = activeTab?.items ?? []

  const { data } = useQuery<PosPricingData>({
    queryKey: ['pos-pricing', tenantId, customerId ?? null],
    queryFn: () => getPosPricingData(tenantId!, customerId),
    enabled: !!tenantId,
    staleTime: 60_000,
  })

  // Firma estable: solo (producto, cantidad) — el precio NO va aquí para no ciclar
  const cartSignature = items.map(i => `${i.productId}:${i.quantity}`).join('|')

  const pricer = useMemo(() => {
    if (!data) return null
    const { promotions, volumeItems, customerItems } = data

    const bestTier = (rows: PriceListItemRow[], productId: string, qty: number) => {
      const candidates = rows
        .filter(r => r.product_id === productId && Number(r.min_qty) <= qty)
        .sort((a, b) => Number(b.min_qty) - Number(a.min_qty))
      return candidates[0] ?? null
    }

    return (item: CartItem): { price?: number; discount?: number } | null => {
      // 1) Lista del cliente
      const custTier = bestTier(customerItems, item.productId, item.quantity)
      if (custTier) return { price: Number(custTier.price), discount: 0 }

      // 2) Listas VOLUME
      const volTier = bestTier(volumeItems, item.productId, item.quantity)
      if (volTier) return { price: Number(volTier.price), discount: 0 }

      // 3) Promociones PERCENT / FIXED
      const promo = promotions.find(p => {
        if (!p.is_active) return false
        if (p.type !== 'PERCENT' && p.type !== 'FIXED') return false
        if (item.quantity < (p.min_qty ?? 1)) return false
        if (p.scope === 'PRODUCT')  return p.product_id === item.productId
        if (p.scope === 'CATEGORY') return !!item.categoryId && p.category_id === item.categoryId
        return p.scope === 'ALL'
      })
      if (promo) {
        if (promo.type === 'PERCENT') return { discount: Number(promo.value) }
        // FIXED: monto fijo de descuento sobre el precio unitario
        const pct = item.price > 0 ? Math.min(100, (Number(promo.value) / item.price) * 100) : 0
        return { discount: Math.round(pct * 100) / 100 }
      }

      // Nada aplica → restaurar descuento automático a 0 no es seguro
      // (podría pisar un descuento manual). No tocar.
      return null
    }
  }, [data])

  useEffect(() => {
    if (!pricer) return
    repriceItems(pricer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricer, cartSignature, customerId])
}
