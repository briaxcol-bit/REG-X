/**
 * PhoneField — wrapper de react-phone-number-input con estilos REG-X.
 * Selector de país personalizado (portal) + validación con libphonenumber-js.
 * País por defecto: Colombia (CO).
 */

import { useState, useRef, useEffect, useMemo, forwardRef } from 'react'
import { createPortal } from 'react-dom'
import PhoneInput, {
  type Country,
  getCountryCallingCode,
} from 'react-phone-number-input'
import { isValidPhoneNumber, getExampleNumber } from 'libphonenumber-js'
import examples from 'libphonenumber-js/mobile/examples'
import { Search, ChevronDown } from 'lucide-react'
import { cn } from '@shared/utils/cn'

// ── Dropdown de países con portal ─────────────────────────────────
interface SelectOption {
  value?:   Country
  label:    string
  divider?: boolean
}

interface CountrySelectProps {
  value?:        Country
  onChange:      (val?: Country) => void
  options:       SelectOption[]
  iconComponent: React.ComponentType<{ country: Country; label: string }>
  disabled?:     boolean
}

function CustomCountrySelect({ value, onChange, options, iconComponent: FlagIcon, disabled }: CountrySelectProps) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const btnRef = useRef<HTMLButtonElement>(null)
  const [rect,  setRect]    = useState<DOMRect | null>(null)

  const handleOpen = () => {
    if (disabled) return
    setRect(btnRef.current?.getBoundingClientRect() ?? null)
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open])

  const filtered = options.filter(o =>
    !o.divider && o.value &&
    o.label.toLowerCase().includes(search.toLowerCase()),
  )

  const dropH  = Math.min(240, filtered.length * 38 + 52)
  const openUp = rect
    ? (window.innerHeight - rect.bottom < dropH + 8) && rect.top > dropH + 8
    : false
  const top  = rect ? (openUp ? rect.top - dropH - 4 : rect.bottom + 4) : 0
  const left = rect ? rect.left : 0

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className="flex items-center gap-1 px-2 py-2 text-grafito-700 dark:text-grafito-200 hover:text-brand-500 transition-colors shrink-0 disabled:opacity-50"
      >
        {value ? <FlagIcon country={value} label={value} /> : <span className="text-sm">🌍</span>}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => { setOpen(false); setSearch('') }} />
          <div
            style={{ position: 'fixed', top, left, width: 230, zIndex: 9999 }}
            className="rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-grafito-100 dark:border-white/5">
              <Search className="h-3.5 w-3.5 text-grafito-400 shrink-0" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar país..."
                className="flex-1 bg-transparent text-xs text-grafito-900 dark:text-white placeholder:text-grafito-400 outline-none"
              />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
              {filtered.length === 0 ? (
                <p className="py-4 text-center text-xs text-grafito-400">Sin resultados.</p>
              ) : filtered.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); setSearch('') }}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors',
                    opt.value === value && 'bg-brand-500/10 text-brand-500 font-semibold',
                  )}
                >
                  <FlagIcon country={opt.value!} label={opt.label} />
                  <span className="flex-1 truncate text-grafito-800 dark:text-grafito-200">{opt.label}</span>
                  <span className="text-grafito-400 font-mono shrink-0">
                    +{getCountryCallingCode(opt.value!)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}

// ── PhoneField ────────────────────────────────────────────────────
interface PhoneFieldProps {
  value:           string | undefined
  onChange:        (val: string | undefined) => void
  label?:          string
  required?:       boolean
  placeholder?:    string
  className?:      string
  showValidation?: boolean
}

export function PhoneField({
  value,
  onChange,
  label,
  required,
  placeholder = 'Ej: 300 123 4567',
  className,
  showValidation = true,
}: PhoneFieldProps) {
  const [country, setCountry] = useState<Country>('CO')

  const hasValue = !!value && value.length > 2
  const isValid  = hasValue ? isValidPhoneNumber(value!) : null

  // Largo máximo e.g "+57 300 123 4567" = 17 chars
  const maxLength = useMemo(() => {
    try {
      const ex = getExampleNumber(country, examples)
      return ex ? ex.formatInternational().length : 18
    } catch {
      return 18
    }
  }, [country])

  // Placeholder dinámico por país, e.g. "+57 300 123 4567"
  const dynamicPlaceholder = useMemo(() => {
    try {
      return getExampleNumber(country, examples)?.formatInternational() ?? placeholder
    } catch {
      return placeholder
    }
  }, [country, placeholder])

  // Input personalizado con maxLength nativo — bloquea a nivel del DOM
  const LimitedInput = useMemo(
    () =>
      forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
        (props, ref) => <input {...props} ref={ref} maxLength={maxLength} />,
      ),
    [maxLength],
  )

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="block text-xs font-semibold text-grafito-600 dark:text-grafito-300 mb-1.5">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}

      <div className={cn(
        'flex items-center rounded-xl border bg-grafito-50 dark:bg-grafito-800 transition-all focus-within:ring-2',
        hasValue && showValidation
          ? isValid
            ? 'border-emerald-500 focus-within:ring-emerald-500/20'
            : 'border-red-400 focus-within:ring-red-400/20'
          : 'border-grafito-200 dark:border-white/10 focus-within:border-brand-500 focus-within:ring-brand-500/20',
      )}>
        <PhoneInput
          international
          countryCallingCodeEditable={false}
          defaultCountry={'CO' as Country}
          onCountryChange={c => setCountry(c ?? 'CO')}
          countrySelectComponent={CustomCountrySelect}
          inputComponent={LimitedInput}
          value={value}
          onChange={onChange}
          placeholder={dynamicPlaceholder}
          className="phone-field-inner w-full"
        />
      </div>

      {hasValue && showValidation && isValid === false && (
        <p className="text-[11px] text-red-400 mt-1">Número inválido para el país seleccionado.</p>
      )}
    </div>
  )
}
