import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import { useEffect } from 'react'

import { router } from '@/router'
import { queryClient } from '@lib/query-client'
import { supabase } from '@lib/supabase'
import { useAuthStore } from '@store/auth.store'
import { usePOSStore } from '@store/pos.store'

function AuthInitializer() {
  const { setUser, setSession, setLoading, setInitialized, logout } = useAuthStore()
  const { setOffline } = usePOSStore()

  useEffect(() => {
    // ── Bootstrap session ──────────────────────────────
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
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
  }, [setUser, setSession, setLoading, setInitialized, logout, setOffline])

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
