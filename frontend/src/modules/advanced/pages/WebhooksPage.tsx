import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Webhook, Plus, Loader2, X, Trash2, KeyRound, Power, Copy, Check } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import {
  getWebhookEndpoints, createWebhookEndpoint, setWebhookActive, deleteWebhookEndpoint,
  getApiKeys, createApiKey, revokeApiKey, type WebhookRow, type ApiKeyRow,
} from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none'

const EVENTS = ['sale.created', 'sale.cancelled', 'product.updated', 'inventory.low', 'customer.created', 'cash.closed']

function WebhookModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>([])
  const toggle = (e: string) => setEvents((a) => a.includes(e) ? a.filter((x) => x !== e) : [...a, e])
  const save = useMutation({
    mutationFn: () => createWebhookEndpoint(tenantId, { url, events }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhooks', tenantId] }); toast.success('Webhook creado'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo crear'),
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h3 className="text-base font-bold text-grafito-900 dark:text-white">Nuevo webhook</h3><button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button></div>
        <div className="space-y-4">
          <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">URL destino</label><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://tuservidor.com/webhook" className={inputCls} /></div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-2">Eventos</label>
            <div className="grid grid-cols-2 gap-2">
              {EVENTS.map((e) => (
                <button key={e} type="button" onClick={() => toggle(e)} className={cn('text-left text-xs font-mono px-2.5 py-1.5 rounded-lg border transition-colors', events.includes(e) ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300' : 'border-grafito-200 dark:border-white/10 text-grafito-500')}>{e}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!/^https?:\/\//.test(url) || events.length === 0 || save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear</button>
        </div>
      </div>
    </div>
  )
}

function NewKeyModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [raw, setRaw] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const create = useMutation({
    mutationFn: () => createApiKey(tenantId, name),
    onSuccess: (key) => { qc.invalidateQueries({ queryKey: ['api-keys', tenantId] }); setRaw(key) },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo crear'),
  })
  const copy = () => { navigator.clipboard?.writeText(raw ?? ''); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h3 className="text-base font-bold text-grafito-900 dark:text-white">Nueva API key</h3><button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button></div>
        {raw ? (
          <div className="space-y-3">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Copia esta clave ahora — no se vuelve a mostrar.</p>
            <div className="flex items-center gap-2 rounded-xl bg-grafito-50 dark:bg-white/5 border border-grafito-200 dark:border-white/10 px-3 py-2.5">
              <code className="flex-1 text-xs font-mono text-grafito-900 dark:text-white break-all">{raw}</code>
              <button onClick={copy} className="shrink-0 rounded-md p-1.5 text-grafito-400 hover:text-brand-500 hover:bg-brand-500/10">{copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}</button>
            </div>
            <button onClick={onClose} className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">Listo</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Nombre</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Integración ERP" className={inputCls} /></div>
            <button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Generar clave</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function WebhooksPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const qc = useQueryClient()
  const [newHook, setNewHook] = useState(false)
  const [newKey, setNewKey] = useState(false)

  const { data: hooks = [] } = useQuery({ queryKey: ['webhooks', tenantId], queryFn: () => getWebhookEndpoints(tenantId!), enabled: !!tenantId })
  const { data: keys = [] } = useQuery({ queryKey: ['api-keys', tenantId], queryFn: () => getApiKeys(tenantId!), enabled: !!tenantId })

  const toggleHook = useMutation({ mutationFn: (h: WebhookRow) => setWebhookActive(tenantId!, h.id, !h.active), onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks', tenantId] }) })
  const delHook = useMutation({ mutationFn: (id: string) => deleteWebhookEndpoint(tenantId!, id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhooks', tenantId] }); toast.success('Webhook eliminado') } })
  const revoke = useMutation({ mutationFn: (id: string) => revokeApiKey(tenantId!, id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['api-keys', tenantId] }); toast.success('Clave revocada') } })

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-brand-500/10 p-2.5"><Webhook className="h-5 w-5 text-brand-500" /></div>
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Webhooks / API</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">Integra REG-X con sistemas externos.</p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-2xl bg-blue-500/10 border border-blue-500/20 px-5 py-3">
        <span className="text-xs text-blue-500 dark:text-blue-300">Aquí registras endpoints y llaves. El <b>envío real</b> de los eventos y la validación de las llaves se activan con el backend (fase posterior); por ahora es la configuración.</span>
      </div>

      {/* Webhooks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-grafito-400">Endpoints</h2>
          <button onClick={() => setNewHook(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"><Plus className="h-3.5 w-3.5" /> Nuevo webhook</button>
        </div>
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-hidden">
          {hooks.length === 0 ? <p className="text-sm text-grafito-400 text-center py-8">Sin webhooks configurados.</p> : (
            <div className="divide-y divide-grafito-100 dark:divide-white/5">
              {hooks.map((h) => (
                <div key={h.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-grafito-900 dark:text-white truncate">{h.url}</p>
                    <p className="text-[11px] text-grafito-400">{h.events.join(', ')}</p>
                  </div>
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0', h.active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-grafito-200 dark:bg-white/10 text-grafito-500')}>{h.active ? 'Activo' : 'Inactivo'}</span>
                  <button onClick={() => toggleHook.mutate(h)} className="rounded-lg p-1.5 text-grafito-400 hover:text-brand-500 hover:bg-brand-500/10"><Power className="h-4 w-4" /></button>
                  <button onClick={() => { if (confirm('¿Eliminar este webhook?')) delHook.mutate(h.id) }} className="rounded-lg p-1.5 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* API keys */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-grafito-400">API Keys</h2>
          <button onClick={() => setNewKey(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"><KeyRound className="h-3.5 w-3.5" /> Nueva clave</button>
        </div>
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-hidden">
          {keys.length === 0 ? <p className="text-sm text-grafito-400 text-center py-8">Sin llaves generadas.</p> : (
            <div className="divide-y divide-grafito-100 dark:divide-white/5">
              {keys.map((k) => (
                <div key={k.id} className={cn('flex items-center gap-3 px-4 py-3', !k.is_active && 'opacity-50')}>
                  <KeyRound className="h-4 w-4 text-grafito-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-grafito-900 dark:text-white">{k.name}</p>
                    <p className="text-[11px] font-mono text-grafito-400">{k.key_prefix}••••••••</p>
                  </div>
                  {k.is_active
                    ? <button onClick={() => { if (confirm(`¿Revocar la clave "${k.name}"?`)) revoke.mutate(k.id) }} className="text-xs font-semibold text-red-500 hover:bg-red-500/10 rounded-lg px-2.5 py-1">Revocar</button>
                    : <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-grafito-200 dark:bg-white/10 text-grafito-500">Revocada</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {newHook && tenantId && <WebhookModal tenantId={tenantId} onClose={() => setNewHook(false)} />}
      {newKey && tenantId && <NewKeyModal tenantId={tenantId} onClose={() => setNewKey(false)} />}
    </div>
  )
}
