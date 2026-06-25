import { useEffect } from 'react'
import { useAuthStore } from '@store/auth.store'

/**
 * useTenantTheme
 * ─────────────────────────────────────────────────────────────
 * Inyecta los colores de la marca del tenant activo como
 * variables CSS en el elemento <html>. Esto permite que toda
 * la UI use `var(--tenant-primary)` y `var(--tenant-secondary)`
 * sin necesidad de clases de Tailwind hardcodeadas.
 *
 * Se resetea a los valores por defecto de REG-X cuando el
 * usuario cierra sesión o no tiene tenant activo.
 */

const DEFAULT_PRIMARY   = '#F20D18'
const DEFAULT_SECONDARY = '#111827'

function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '0 0% 50%'

  let r = parseInt(result[1], 16) / 255
  let g = parseInt(result[2], 16) / 255
  let b = parseInt(result[3], 16) / 255

  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

function applyTheme(primary: string, secondary: string) {
  const root = document.documentElement
  root.style.setProperty('--tenant-primary',   primary)
  root.style.setProperty('--tenant-secondary', secondary)
  // También actualiza las variables CSS de Shadcn/UI para que los
  // componentes que usen hsl(var(--primary)) también cambien
  root.style.setProperty('--primary', hexToHsl(primary))
  root.style.setProperty('--ring',    hexToHsl(primary))
}

export function useTenantTheme() {
  const { tenant, profile } = useAuthStore()

  useEffect(() => {
    const isSuperAdmin = profile?.platformRole === 'SUPER_ADMIN'

    if (isSuperAdmin || !tenant) {
      // El super-admin y los usuarios sin tenant siempre ven el rojo REG-X
      applyTheme(DEFAULT_PRIMARY, DEFAULT_SECONDARY)
      return
    }

    const primary   = tenant.primaryColor   || DEFAULT_PRIMARY
    const secondary = tenant.secondaryColor || DEFAULT_SECONDARY
    applyTheme(primary, secondary)

    return () => {
      // Cleanup: restaurar colores default al desmontar
      applyTheme(DEFAULT_PRIMARY, DEFAULT_SECONDARY)
    }
  }, [tenant?.primaryColor, tenant?.secondaryColor, profile?.platformRole])
}
