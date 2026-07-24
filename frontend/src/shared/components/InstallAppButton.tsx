/**
 * Botón "Descargar app" (instalar PWA) — visible para todos los roles.
 * - Si el navegador ofrece instalación → lanza el diálogo nativo.
 * - iOS/Safari → instrucciones manuales (Compartir → Agregar a inicio).
 * - Otro caso → indica usar Chrome/Edge.
 * - Si la app ya corre instalada (standalone) no se muestra.
 */
import { useState, useEffect } from 'react'
import { MonitorDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  isInstalled, canInstall, isIOS, promptInstall, onInstallAvailabilityChange,
} from '@lib/pwa-install'
import { cn } from '@shared/utils/cn'

interface InstallAppButtonProps {
  /** 'menu' = ítem de dropdown · 'button' = botón compacto de barra */
  variant?: 'menu' | 'button'
  /** Callback tras el click (p. ej. cerrar el dropdown) */
  onAfterClick?: () => void
  className?: string
}

export function InstallAppButton({ variant = 'menu', onAfterClick, className }: InstallAppButtonProps) {
  const [, forceRender] = useState(0)
  const [installing, setInstalling] = useState(false)

  useEffect(() => onInstallAvailabilityChange(() => forceRender(n => n + 1)), [])

  // Ya corre como app instalada: el botón no aporta nada
  if (isInstalled()) return null

  const handleClick = async () => {
    onAfterClick?.()
    if (canInstall()) {
      setInstalling(true)
      try {
        const ok = await promptInstall()
        toast[ok ? 'success' : 'info'](ok
          ? 'REG-X instalada: búscala en tu escritorio o pantalla de inicio'
          : 'Instalación cancelada')
      } finally {
        setInstalling(false)
      }
      return
    }
    if (isIOS()) {
      toast.info('En iPhone/iPad: toca Compartir en Safari y elige "Agregar a pantalla de inicio".', { duration: 8000 })
      return
    }
    toast.info('La instalación se ofrece en Chrome o Edge (HTTPS). También puedes usar el ícono de instalar en la barra de direcciones.', { duration: 8000 })
  }

  const Icon = installing ? Loader2 : MonitorDown

  if (variant === 'button') {
    return (
      <button
        onClick={handleClick}
        disabled={installing}
        title="Descargar app"
        className={cn(
          'flex items-center gap-1.5 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-100 dark:bg-grafito-800 px-3 py-2 text-xs font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-brand-50 dark:hover:bg-brand-500/10 hover:text-brand-600 dark:hover:text-brand-400 hover:border-brand-200 dark:hover:border-brand-500/30 transition-colors disabled:opacity-50',
          className,
        )}
      >
        <Icon className={cn('h-3.5 w-3.5', installing && 'animate-spin')} />
        <span className="hidden sm:inline">Descargar app</span>
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={installing}
      className={cn(
        'w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-grafito-700 dark:text-grafito-200 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50',
        className,
      )}
    >
      <Icon className={cn('h-4 w-4 text-grafito-400', installing && 'animate-spin')} />
      Descargar app
    </button>
  )
}
