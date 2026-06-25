import { useAuthStore } from '@store/auth.store'

interface RequirePermissionProps {
  permission: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function RequirePermission({ permission, children, fallback = null }: RequirePermissionProps) {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>
}
