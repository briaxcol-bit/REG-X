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
    // Hidrata perfil/tenant/branch desde la BD para una sesión activa.
    // Se ejecuta tanto en el arranque como tras recargar la página,
    // garantizando que platformRole (SUPER_ADMIN) siempre quede correcto.
    const hydrateProfile = async (userId: string, email: string) => {
      try {
        const ctx = await resolveUserContext(userId)

        setProfile({
          id:           userId,
          email,
          fullName:     ctx?.profile?.full_name ?? email.split('@')[0] ?? email,
          permissions:  ctx?.profile?.platform_role === 'SUPER_ADMIN' ? ['*'] : [],
          platformRole: (ctx?.profile?.platform_role as any) ?? undefined,
          businessRole: ctx?.role?.role as any,
        })

        if (ctx?.tenant) {
          setTenant({
            tenantId:       ctx.tenant.id,
            tenantName:     ctx.tenant.name,
            tenantSlug:     ctx.tenant.slug,
            plan:           ctx.tenant.plan as any,
            businessType:   ctx.tenant.business_type,
            logoUrl:        ctx.tenant.logo_url ?? undefined,
            primaryColor:   ctx.tenant.primary_color ?? undefined,
            secondaryColor: ctx.tenant.secondary_color ?? undefined,
          })
        } else {
          // SUPER_ADMIN de plataforma puede no tener tenant activo
          setTenant(null)
        }

        if (ctx?.branch) {
          setBranch({
            branchId:   ctx.branch.id,
            branchName: ctx.branch.name,
            branchCode: ctx.branch.code,
            currency:   ctx.branch.currency ?? ctx?.tenant?.currency ?? 'COP',
            timezone:   ctx.branch.timezone ?? ctx?.tenant?.timezone ?? 'America/Bogota',
            country:    ctx?.tenant?.country ?? 'CO',
          })
        }
      } catch (err) {
        console.error('No se pudo hidratar el perfil:', err)
      }
    }

    // ── Bootstrap session ──────────────────────────────
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const backendToken = localStorage.getItem('regx:access_token')

      if (session?.user) {
        // Sesión Supabase activa
        setSession(session)
        setUser(session.user)
        await hydrateProfile(session.user.id, session.user.email ?? '')
      } else if (backendToken) {
        // JWT del backend presente — no desloguear, el perfil ya está en el store (persist)
        setSession(null)
      } else {
        // Sin sesión de ningún tipo
        logout()
      }
      setLoading(false)
      setInitialized(true)
    })

    // ── Listen to auth changes ─────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (!session && !localStorage.getItem('regx:access_token')) {
          logout()
          return
        }
        // Re-hidrata el perfil al iniciar sesión o restaurar el token
        if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          await hydrateProfile(session.user.id, session.user.email ?? '')
        }
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
