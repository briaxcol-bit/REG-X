import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, Loader2, Plus, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { getAuditLogs, type AuditLogRow } from '@lib/db'

const ACTION = {
  INSERT: { label: 'Creó', cls: 'bg-emerald-500/10 text-emerald-500', Icon: Plus },
  UPDATE: { label: 'Editó', cls: 'bg-blue-500/10 text-blue-500', Icon: Pencil },
  DELETE: { label: 'Eliminó', cls: 'bg-red-500/10 text-red-500', Icon: Trash2 },
} as const

const RESOURCE_LABEL: Record<string, string> = {
  sales: 'Venta', products: 'Producto', cash_registers: 'Caja',
}

export default function AuditPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const [action, setAction] = useState('')
  const [resource, setResource] = useState('')

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit', tenantId, action, resource],
    queryFn: () => getAuditLogs(tenantId!, { action: action || undefined, resourceType: resource || undefined }),
    enabled: !!tenantId,
  })

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-brand-500/10 p-2.5"><ShieldCheck className="h-5 w-5 text-brand-500" /></div>
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Auditoría</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">Registro de acciones críticas por usuario.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={action} onChange={(e) => setAction(e.target.value)} className="text-sm px-3 py-2.5 rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 text-grafito-700 dark:text-grafito-200">
          <option value="">Todas las acciones</option>
          <option value="INSERT">Creaciones</option>
          <option value="UPDATE">Ediciones</option>
          <option value="DELETE">Eliminaciones</option>
        </select>
        <select value={resource} onChange={(e) => setResource(e.target.value)} className="text-sm px-3 py-2.5 rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 text-grafito-700 dark:text-grafito-200">
          <option value="">Todo</option>
          <option value="sales">Ventas</option>
          <option value="products">Productos</option>
          <option value="cash_registers">Caja</option>
        </select>
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-x-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><ShieldCheck className="h-8 w-8" /><p className="text-sm">Aún no hay registros de auditoría.</p></div>
        ) : (
          <table className="w-full text-left text-sm min-w-[680px]">
            <thead><tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5"><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Acción</th><th className="px-4 py-3">Recurso</th><th className="px-4 py-3">Usuario</th></tr></thead>
            <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
              {logs.map((l: AuditLogRow) => {
                const a = ACTION[l.action as keyof typeof ACTION]
                return (
                  <tr key={l.id} className="hover:bg-grafito-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 text-grafito-500 dark:text-grafito-300 whitespace-nowrap">{new Date(l.created_at).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-4 py-3">
                      {a
                        ? <span className={cn('inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold', a.cls)}><a.Icon className="h-3 w-3" /> {a.label}</span>
                        : <span className="text-grafito-500">{l.action}</span>}
                    </td>
                    <td className="px-4 py-3 text-grafito-800 dark:text-grafito-100">{RESOURCE_LABEL[l.resource_type] ?? l.resource_type}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-grafito-400">{l.user_id ? l.user_id.slice(0, 8) : 'sistema'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
