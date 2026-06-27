/**
 * PhoneField — wrapper de react-phone-number-input con estilos REG-X.
 * Selector de país + validación con libphonenumber-js.
 * País por defecto: Colombia (CO).
 *
 * Uso:
 *   <PhoneField value={phone} onChange={setPhone} />
 *   <PhoneField value={phone} onChange={setPhone} label="Celular" required />
 */

import PhoneInput, { type Country } from 'react-phone-number-input'
import { isValidPhoneNumber } from 'libphonenumber-js'
import { cn } from '@shared/utils/cn'

interface PhoneFieldProps {
  value:       string | undefined
  onChange:    (val: string | undefined) => void
  label?:      string
  required?:   boolean
  placeholder?: string
  className?:  string
  showValidation?: boolean   // muestra check/error inline
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
  const hasValue = !!value && value.length > 2
  const isValid  = hasValue ? isValidPhoneNumber(value!) : null

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="block text-xs font-semibold text-grafito-600 dark:text-grafito-300 mb-1.5">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}

      <div className={cn(
        'rounded-xl border bg-grafito-50 dark:bg-grafito-800 transition-all focus-within:ring-2',
        hasValue && showValidation
          ? isValid
            ? 'border-emerald-500 focus-within:ring-emerald-500/20'
            : 'border-red-400 focus-within:ring-red-400/20'
          : 'border-grafito-200 dark:border-white/10 focus-within:border-brand-500 focus-within:ring-brand-500/20'
      )}>
        <PhoneInput
          international
          countryCallingCodeEditable={false}
          defaultCountry={'CO' as Country}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="phone-field-inner w-full"
        />
      </div>

      {hasValue && showValidation && isValid === false && (
        <p className="text-[11px] text-red-400 mt-1">Número inválido para el país seleccionado.</p>
      )}
    </div>
  )
}
