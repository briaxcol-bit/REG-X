/**
 * REG-X — Sincronización de ventas offline (ADR-003)
 *
 * Las ventas hechas sin internet se encolan en pendingSync (persistido en
 * localStorage). Este módulo las reenvía al volver la conexión:
 *
 *  - order_number FIJO por venta + índice único (migración 047) →
 *    un reintento duplicado falla con 23505 y se trata como "ya sincronizada".
 *  - Error de stock (el servidor valida al sincronizar) → la venta queda en
 *    estado REVIEW con el motivo, para resolución manual.
 *  - Error de red → se detiene el ciclo (seguimos offline) y se reintenta
 *    en el próximo evento 'online' o intervalo.
 */
import { toast } from 'sonner'
import { createSale, type CreateSalePayload } from '@lib/db'
import { usePOSStore, type PendingSale } from '@store/pos.store'

export function isNetworkError(e: unknown): boolean {
  if (e instanceof TypeError) return true
  const msg = String((e as { message?: string })?.message ?? e).toLowerCase()
  return /failed to fetch|network|load failed|fetch failed|timeout|err_internet/.test(msg)
}

let syncing = false

/** Reenvía las ventas PENDING de la cola. Seguro de llamar cuantas veces sea. */
export async function syncPendingSales(): Promise<void> {
  if (syncing || !navigator.onLine) return
  const store = usePOSStore.getState()
  const pending = store.pendingSync.filter(p => p.status === 'PENDING')
  if (pending.length === 0) return

  syncing = true
  let synced = 0
  try {
    for (const p of pending) {
      try {
        await createSale(p.tenantId, p.branchId, p.userId, p.payload as unknown as CreateSalePayload)
        usePOSStore.getState().removePendingSale(p.id)
        synced++
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string }
        if (err?.code === '23505' || /uq_sales_tenant_order_number|duplicate key/i.test(err?.message ?? '')) {
          // Ya existe en el servidor (reintento previo llegó): sincronizada.
          usePOSStore.getState().removePendingSale(p.id)
          synced++
        } else if (isNetworkError(e)) {
          break // seguimos offline; reintentar después
        } else {
          // Rechazo del servidor (p.ej. stock insuficiente): requiere revisión
          usePOSStore.getState().markPendingReview(p.id, err?.message ?? 'Error desconocido')
          toast.error(`Venta offline ${p.payload.order_number} requiere revisión: ${err?.message ?? ''}`, { duration: 8000 })
        }
      }
    }
  } finally {
    syncing = false
  }

  if (synced > 0) {
    toast.success(`${synced} venta${synced !== 1 ? 's' : ''} offline sincronizada${synced !== 1 ? 's' : ''}`)
  }
}

/** Instala los listeners de reconexión + reintento periódico. Llamar una vez. */
export function startOfflineSalesSync(): () => void {
  const onOnline = () => { void syncPendingSales() }
  window.addEventListener('online', onOnline)
  void syncPendingSales() // por si quedaron ventas de una sesión anterior
  const interval = window.setInterval(() => { void syncPendingSales() }, 60_000)
  return () => {
    window.removeEventListener('online', onOnline)
    window.clearInterval(interval)
  }
}
