import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BookOpen, Plus, Loader2, X, Trash2, Pencil, Scale } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import {
  getAccounts, createAccount, updateAccount, deleteAccount,
  getJournalEntries, createJournalEntry, getTrialBalance,
  type AccountRow, type AccountType, type JournalLineInput,
} from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none'

const TYPE_LABEL: Record<AccountType, string> = { ASSET: 'Activo', LIABILITY: 'Pasivo', EQUITY: 'Patrimonio', INCOME: 'Ingreso', EXPENSE: 'Gasto' }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>{children}</div>
}

// ── Modal cuenta ──────────────────────────────────────────────
function AccountModal({ tenantId, editing, onClose }: { tenantId: string; editing: AccountRow | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [code, setCode] = useState(editing?.code ?? '')
  const [name, setName] = useState(editing?.name ?? '')
  const [type, setType] = useState<AccountType>(editing?.type ?? 'ASSET')
  const save = useMutation({
    mutationFn: () => editing ? updateAccount(tenantId, editing.id, { code: code.trim(), name: name.trim(), type }) : createAccount(tenantId, { code: code.trim(), name: name.trim(), type }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts', tenantId] }); toast.success('Cuenta guardada'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo guardar'),
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h3 className="text-base font-bold text-grafito-900 dark:text-white">{editing ? 'Editar cuenta' : 'Nueva cuenta'}</h3><button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button></div>
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <Field label="Código"><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="1105" className={cn(inputCls, 'font-mono')} /></Field>
            <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Caja general" className={inputCls} /></Field>
          </div>
          <Field label="Tipo"><select value={type} onChange={(e) => setType(e.target.value as AccountType)} className={inputCls}>{(Object.keys(TYPE_LABEL) as AccountType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></Field>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!code.trim() || !name.trim() || save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Guardar</button>
        </div>
      </div>
    </div>
  )
}

// ── Modal asiento ─────────────────────────────────────────────
type LineDraft = JournalLineInput & { key: number }
function EntryModal({ tenantId, accounts, onClose }: { tenantId: string; accounts: AccountRow[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([{ key: 1, account_id: '', debit: 0, credit: 0 }, { key: 2, account_id: '', debit: 0, credit: 0 }])

  const setLine = (k: number, patch: Partial<LineDraft>) => setLines((a) => a.map((l) => l.key === k ? { ...l, ...patch } : l))
  const addRow = () => setLines((a) => [...a, { key: Date.now(), account_id: '', debit: 0, credit: 0 }])
  const delRow = (k: number) => setLines((a) => a.filter((l) => l.key !== k))
  const totDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0)
  const totCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0)
  const balanced = totDebit > 0 && Math.abs(totDebit - totCredit) < 0.01
  const valid = balanced && lines.filter((l) => l.account_id && (Number(l.debit) || Number(l.credit))).length >= 2

  const save = useMutation({
    mutationFn: () => createJournalEntry(tenantId, { entry_date: date, reference: reference.trim() || null, description: description.trim() || null },
      lines.filter((l) => l.account_id).map(({ account_id, debit, credit }) => ({ account_id, debit: Number(debit) || 0, credit: Number(credit) || 0 }))),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['journal', tenantId] }); qc.invalidateQueries({ queryKey: ['trial-balance', tenantId] }); toast.success('Asiento registrado'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo registrar'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h3 className="text-base font-bold text-grafito-900 dark:text-white">Nuevo asiento contable</h3><button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Fecha"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field>
          <Field label="Referencia"><input value={reference} onChange={(e) => setReference(e.target.value)} className={inputCls} /></Field>
          <Field label="Descripción"><input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} /></Field>
        </div>
        {accounts.length === 0 && <p className="mt-4 text-xs text-amber-600 dark:text-amber-400">Primero crea cuentas en el Plan de cuentas.</p>}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2"><p className="text-[11px] font-bold uppercase tracking-wide text-grafito-400">Movimientos</p><button onClick={addRow} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-500 hover:text-brand-600"><Plus className="h-3.5 w-3.5" /> Línea</button></div>
          <div className="space-y-2">
            {lines.map((l) => (
              <div key={l.key} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center">
                <select value={l.account_id} onChange={(e) => setLine(l.key, { account_id: e.target.value })} className={inputCls}>
                  <option value="">Cuenta…</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                </select>
                <input type="number" min={0} value={l.debit || ''} onChange={(e) => setLine(l.key, { debit: Number(e.target.value), credit: 0 })} placeholder="Débito" className={inputCls} />
                <input type="number" min={0} value={l.credit || ''} onChange={(e) => setLine(l.key, { credit: Number(e.target.value), debit: 0 })} placeholder="Crédito" className={inputCls} />
                <button onClick={() => delRow(l.key)} className="rounded-lg p-2 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-6 mt-3 text-sm">
            <span className="text-grafito-500">Débitos: <span className="font-bold text-grafito-900 dark:text-white">{formatCurrency(totDebit, 'COP')}</span></span>
            <span className="text-grafito-500">Créditos: <span className="font-bold text-grafito-900 dark:text-white">{formatCurrency(totCredit, 'COP')}</span></span>
            <span className={cn('font-bold', balanced ? 'text-emerald-500' : 'text-red-500')}>{balanced ? 'Cuadrado ✓' : 'Descuadrado'}</span>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!valid || save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Registrar</button>
        </div>
      </div>
    </div>
  )
}

export default function AccountingPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const qc = useQueryClient()
  const [tab, setTab] = useState<'accounts' | 'journal' | 'balance'>('accounts')
  const [acctModal, setAcctModal] = useState<{ editing: AccountRow | null } | null>(null)
  const [entryModal, setEntryModal] = useState(false)

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts', tenantId], queryFn: () => getAccounts(tenantId!), enabled: !!tenantId })
  const { data: entries = [] } = useQuery({ queryKey: ['journal', tenantId], queryFn: () => getJournalEntries(tenantId!), enabled: !!tenantId && tab === 'journal' })
  const { data: balance = [] } = useQuery({ queryKey: ['trial-balance', tenantId], queryFn: () => getTrialBalance(tenantId!), enabled: !!tenantId && tab === 'balance' })

  const delAcct = useMutation({ mutationFn: (id: string) => deleteAccount(tenantId!, id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts', tenantId] }); toast.success('Cuenta eliminada') }, onError: () => toast.error('No se puede: la cuenta tiene movimientos') })

  const totals = useMemo(() => ({
    debit: balance.reduce((s, r) => s + r.debit, 0),
    credit: balance.reduce((s, r) => s + r.credit, 0),
  }), [balance])

  const TABS = [{ id: 'accounts', label: 'Plan de cuentas' }, { id: 'journal', label: 'Libro diario' }, { id: 'balance', label: 'Balance' }] as const

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><BookOpen className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Contabilidad</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Plan de cuentas, libro diario y balance.</p>
          </div>
        </div>
        {tab === 'accounts' && <button onClick={() => setAcctModal({ editing: null })} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"><Plus className="h-4 w-4" /> Nueva cuenta</button>}
        {tab === 'journal' && <button onClick={() => setEntryModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"><Plus className="h-4 w-4" /> Nuevo asiento</button>}
      </div>

      <div className="flex gap-1 rounded-xl bg-grafito-100 dark:bg-white/5 p-1 w-fit">
        {TABS.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={cn('px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors', tab === t.id ? 'bg-white dark:bg-grafito-800 text-brand-500 shadow-sm' : 'text-grafito-500 hover:text-grafito-800 dark:hover:text-white')}>{t.label}</button>)}
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-x-auto">
        {tab === 'accounts' && (
          accounts.length === 0
            ? <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><BookOpen className="h-8 w-8" /><p className="text-sm">Sin cuentas. Crea tu plan de cuentas.</p></div>
            : <table className="w-full text-left text-sm">
                <thead><tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5"><th className="px-4 py-3">Código</th><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead>
                <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
                  {accounts.map((a) => (
                    <tr key={a.id} className="hover:bg-grafito-50 dark:hover:bg-white/5">
                      <td className="px-4 py-3 font-mono font-semibold text-grafito-900 dark:text-white">{a.code}</td>
                      <td className="px-4 py-3 text-grafito-800 dark:text-grafito-100">{a.name}</td>
                      <td className="px-4 py-3"><span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-grafito-100 dark:bg-white/10 text-grafito-600 dark:text-grafito-300">{TYPE_LABEL[a.type]}</span></td>
                      <td className="px-4 py-3"><div className="flex items-center justify-end gap-1"><button onClick={() => setAcctModal({ editing: a })} className="rounded-lg p-1.5 text-grafito-400 hover:text-brand-500 hover:bg-brand-500/10"><Pencil className="h-4 w-4" /></button><button onClick={() => { if (confirm(`¿Eliminar ${a.code}?`)) delAcct.mutate(a.id) }} className="rounded-lg p-1.5 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
        )}

        {tab === 'journal' && (
          entries.length === 0
            ? <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><BookOpen className="h-8 w-8" /><p className="text-sm">Sin asientos registrados.</p></div>
            : <div className="divide-y divide-grafito-100 dark:divide-white/5">
                {entries.map((e) => {
                  const tot = (e.journal_lines ?? []).reduce((s, l) => s + Number(l.debit || 0), 0)
                  return (
                    <div key={e.id} className="px-5 py-4">
                      <div className="flex items-center justify-between">
                        <div><p className="text-sm font-semibold text-grafito-900 dark:text-white">{e.description ?? 'Asiento'}</p><p className="text-xs text-grafito-400">{new Date(e.entry_date + 'T00:00:00').toLocaleDateString('es')}{e.reference ? ` · ${e.reference}` : ''}</p></div>
                        <span className="text-sm font-bold text-grafito-900 dark:text-white">{formatCurrency(tot, 'COP')}</span>
                      </div>
                      <div className="mt-2 space-y-0.5">
                        {(e.journal_lines ?? []).map((l) => (
                          <div key={l.id} className="flex items-center justify-between text-xs text-grafito-500 dark:text-grafito-300">
                            <span>{l.accounts?.code} · {l.accounts?.name}</span>
                            <span className="font-mono">{Number(l.debit) ? `D ${formatCurrency(Number(l.debit), 'COP')}` : `C ${formatCurrency(Number(l.credit), 'COP')}`}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
        )}

        {tab === 'balance' && (
          balance.length === 0
            ? <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><Scale className="h-8 w-8" /><p className="text-sm">Sin movimientos para el balance.</p></div>
            : <table className="w-full text-left text-sm">
                <thead><tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5"><th className="px-4 py-3">Cuenta</th><th className="px-4 py-3 text-right">Débitos</th><th className="px-4 py-3 text-right">Créditos</th><th className="px-4 py-3 text-right">Saldo</th></tr></thead>
                <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
                  {balance.map((r) => (
                    <tr key={r.account_id} className="hover:bg-grafito-50 dark:hover:bg-white/5">
                      <td className="px-4 py-3"><span className="font-mono text-grafito-500">{r.code}</span> <span className="text-grafito-800 dark:text-grafito-100">{r.name}</span></td>
                      <td className="px-4 py-3 text-right text-grafito-600 dark:text-grafito-300">{formatCurrency(r.debit, 'COP')}</td>
                      <td className="px-4 py-3 text-right text-grafito-600 dark:text-grafito-300">{formatCurrency(r.credit, 'COP')}</td>
                      <td className={cn('px-4 py-3 text-right font-semibold', r.balance >= 0 ? 'text-grafito-900 dark:text-white' : 'text-red-500')}>{formatCurrency(r.balance, 'COP')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="border-t border-grafito-200 dark:border-white/10 font-bold"><td className="px-4 py-3 text-grafito-900 dark:text-white">Totales</td><td className="px-4 py-3 text-right">{formatCurrency(totals.debit, 'COP')}</td><td className="px-4 py-3 text-right">{formatCurrency(totals.credit, 'COP')}</td><td className="px-4 py-3" /></tr></tfoot>
              </table>
        )}
      </div>

      {acctModal && tenantId && <AccountModal tenantId={tenantId} editing={acctModal.editing} onClose={() => setAcctModal(null)} />}
      {entryModal && tenantId && <EntryModal tenantId={tenantId} accounts={accounts} onClose={() => setEntryModal(false)} />}
    </div>
  )
}
