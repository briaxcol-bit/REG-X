import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import { useEffect } from 'react'

import { router } from '@/router'
import { queryClient } from '@lib/query-client'
import { supabase } from '@lib/supabase'
import { resolveUserContext } from '@lib/db'
import { startOfflineSalesSync } from '@lib/offline-sync'
import '@lib/pwa-install' // captura beforeinstallprompt desde el arranque (botón en Ajustes → Aplicación)
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

    // ── Failsafe ───────────────────────────────────────
    // Si getSession() se cuelga (lock de auth, red lenta), no dejar la app
    // en el loader para siempre: el perfil/tenant ya están persistidos en
    // localStorage (zustand persist), así que la UI puede renderizar.
    const failsafe = setTimeout(() => {
      setLoading(false)
      setInitialized(true)
    }, 4000)

    // ── Bootstrap session ──────────────────────────────
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(failsafe)
      const backendToken = localStorage.getItem('regx:access_token')

      if (session?.user) {
        // Sesión Supabase activa. La hidratación corre en segundo plano:
        // NO se espera antes de soltar el loader (el perfil persistido
        // en localStorage cubre el primer render).
        setSession(session)
        setUser(session.user)
        void hydrateProfile(session.user.id, session.user.email ?? '')
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
    // IMPORTANTE: el callback debe ser síncrono y no hacer llamadas a
    // Supabase con await. Cada query llama internamente a getSession(),
    // que espera el lock de auth retenido mientras este callback corre
    // → deadlock (la app se queda cargando hasta recargar). Por eso la
    // hidratación se difiere con setTimeout(0), fuera del lock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (!session && !localStorage.getItem('regx:access_token')) {
          // No desloguear por fallos de red: si la tablet estaba dormida o sin
          // internet cuando tocaba refrescar el token, supabase reporta sesión
          // nula transitoriamente. Solo cerramos sesión con un SIGNED_OUT
          // explícito y estando online; al volver la red el token se refresca solo.
          if (event !== 'SIGNED_OUT' || !navigator.onLine) return
          logout()
          return
        }
        // Re-hidrata el perfil al iniciar sesión o restaurar el token
        if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          const { id, email } = session.user
          setTimeout(() => void hydrateProfile(id, email ?? ''), 0)
        }
      },
    )

    // ── Offline detection ──────────────────────────────
    const handleOnline  = () => setOffline(false)
    const handleOffline = () => setOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setOffline(!navigator.onLine)

    // ── Sincronización de ventas offline (ADR-003) ─────
    const stopSync = startOfflineSalesSync()

    return () => {
      clearTimeout(failsafe)
      subscription.unsubscribe()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      stopSync()
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
