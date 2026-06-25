import { Navigate } from 'react-router-dom'
import { useAuthStore, type PlatformRole } from '@store/auth.store'
import { FullscreenLoader } from './FullscreenLoader'

interface RequirePlatformRoleProps {
  role?: PlatformRole
  children: React.ReactNode
}

/**
 * Protege rutas de plataforma. Solo deja pasar a usuarios con el
 * platform_role indicado (por defecto SUPER_ADMIN). Cualquier otro
 * usuario autenticado es redirigido a su dashboard de negocio.
 */
export function RequirePlatformRole({ role = 'SUPER_ADMIN', children }: RequirePlatformRoleProps) {
  const { profile, isInitialized } = useAuthStore()

  if (!isInitialized) return <FullscreenLoader />

  if (profile?.platformRole !== role) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
