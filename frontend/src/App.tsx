import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import { useEffect } from 'react'

import { router } from '@/router'
import { queryClient } from '@lib/query-client'
import { supabase } from '@lib/supabase'
import { resolveUserContext } from '@lib/db'
import { useAuthStore } from '@store/auth.store'
import { usePOSStore } from '@store/pos.store'

function AuthInitializer() {
  const { setUser, setSession, setProfile, setTenant, setBranch, setLoading, setInitialized, logout } = useAuthStore()
  const { setOffline } = usePOSStore()

  useEffect(() => {
    // ── Bootstrap session ──────────────────────────────
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        try {
          const ctx = await resolveUserContext(session.user.id)
          if (ctx) {
            setProfile({
              id:           session.user.id,
              email:        session.user.email!,
              fullName:     ctx.profile?.full_name ?? session.user.user_metadata?.['full_name'] ?? session.user.email!.split('@')[0],
              avatarUrl:    ctx.profile?.avatar_url ?? undefined,
              platformRole: ctx.profile?.platform_role as any ?? undefined,
              businessRole: ctx.role?.role as any ?? undefined,
              permissions:  ctx.profile?.platform_role === 'SUPER_ADMIN' ? ['*'] : [],
            })
            if (ctx.tenant) {
              setTenant({
                tenantId:     ctx.tenant.id,
                tenantName:   ctx.tenant.name,
                tenantSlug:   ctx.tenant.slug,
                plan:         ctx.tenant.plan,
                businessType: ctx.tenant.business_type,
                logoUrl:      ctx.tenant.logo_url ?? undefined,
              })
            }
            if (ctx.branch) {
              setBranch({
                branchId:   ctx.branch.id,
                branchName: ctx.branch.name,
                branchCode: ctx.branch.code,
                currency:   ctx.branch.currency ?? ctx.tenant?.currency ?? 'COP',
                timezone:   ctx.branch.timezone ?? ctx.tenant?.timezone ?? 'America/Bogota',
                country:    ctx.tenant?.country ?? 'CO',
              })
            }
          }
        } catch {
          // Si falla (ej. sin conexión), el perfil cacheado del store persiste
        }
      }

      setLoading(false)
      setInitialized(true)
    })

    // ── Listen to auth changes ─────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (!session) logout()
      },
    )

    // ── Offline detection ──────────────────────────────
    const handleOnline  = () => setOffline(false)
    const handleOffline = () => setOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setOffline(!navigator.onLine)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setUser, setSession, setProfile, setTenant, setBranch, setLoading, setInitialized, logout, setOffline])

  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer />
      <RouterProvider router={router} />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1F2937',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#F9FAFB',
          },
        }}
      />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
