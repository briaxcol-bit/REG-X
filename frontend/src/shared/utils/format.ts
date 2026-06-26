/**
 * Format a number as currency string.
 * Defaults to USD if no currency is provided.
 */
export function formatCurrency(
  amount: number,
  _currency = 'COP', // parameter kept for backwards compatibility but ignored
  locale = 'es-CO',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: Date | string, locale = 'es-CO'): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string, locale = 'es-CO'): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatNumber(value: number, locale = 'es-CO'): string {
  return new Intl.NumberFormat(locale).format(value)
}

export function formatCompact(value: number, locale = 'es-CO'): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(value)
}
