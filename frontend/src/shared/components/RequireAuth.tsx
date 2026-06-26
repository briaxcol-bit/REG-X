import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@store/auth.store'
import { FullscreenLoader } from './FullscreenLoader'

interface RequireAuthProps {
  children: React.ReactNode
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { isAuthenticated, isInitialized } = useAuthStore()
  const location = useLocation()

  if (!isInitialized) return <FullscreenLoader />

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
