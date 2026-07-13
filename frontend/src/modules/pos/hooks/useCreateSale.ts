import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createSale, type CreateSalePayload } from '@lib/db'
import { isNetworkError } from '@lib/offline-sync'
import { useAuthStore } from '@store/auth.store'
import { usePOSStore } from '@store/pos.store'

export type { CreateSalePayload }

/** Métodos que exigen validación contra el servidor: no se aceptan offline. */
const ONLINE_ONLY_METHODS = ['CREDIT', 'GIFT_CARD']

export function useCreateSale() {
  const qc       = useQueryClient()
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const branchId = useAuthStore((s) => s.branch?.branchId)
  const userId   = useAuthStore((s) => s.user?.id)

  return useMutation({
    mutationFn: async (payload: CreateSalePayload) => {
      // Número de orden fijo desde el cliente: si la venta termina en la
      // cola offline, los reintentos son idempotentes (migración 047).
      const orderNumber = payload.order_number
        ?? `ORD-${Date.now().toString(36).toUpperCase()}`
      const finalPayload = { ...payload, order_number: orderNumber }

      const queueOffline = () => {
        if (finalPayload.payments.some(p => ONLINE_ONLY_METHODS.includes(p.method))) {
          throw new Error('Fiado y Gift Card no están disponibles sin internet (requieren validar contra el servidor).')
        }
        usePOSStore.getState().queuePendingSale({
          id:        crypto.randomUUID(),
          tenantId:  tenantId!,
          branchId:  branchId!,
          userId:    userId!,
          payload:   finalPayload as unknown as Record<string, unknown> & { order_number: string },
          createdAt: new Date().toISOString(),
          status:    'PENDING',
        })
        toast.info(`Sin internet: venta ${orderNumber} guardada, se sincronizará sola al volver la conexión.`, { duration: 6000 })
        // Resultado sintético con la misma forma que usa el POS
        return {
          id: null,
          order_number: orderNumber,
          total: finalPayload.total,
          status: finalPayload.status ?? 'COMPLETED',
          offline: true,
        } as unknown as Awaited<ReturnType<typeof createSale>>
      }

      if (!navigator.onLine) return queueOffline()

      try {
        return await createSale(tenantId!, branchId!, userId!, finalPayload)
      } catch (e) {
        if (isNetworkError(e)) return queueOffline()
        throw e
      }
    },
    onError: (e: Error) => {
      toast.error(e?.message ?? 'No se pudo completar la venta')
    },
    onSuccess: () => {
      const opts = { refetchType: 'all' as const }
      qc.invalidateQueries({ queryKey: ['sales'],          ...opts })
      qc.invalidateQueries({ queryKey: ['sales-history'],  ...opts })
      qc.invalidateQueries({ queryKey: ['shift-sales'],    ...opts })
      qc.invalidateQueries({ queryKey: ['pending-sales'],  ...opts })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'],...opts })
      qc.invalidateQueries({ queryKey: ['inventory'],      ...opts })
      qc.invalidateQueries({ queryKey: ['products'],       ...opts })
    },
  })
}
