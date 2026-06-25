import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const supabaseUrl = (import.meta.env['VITE_SUPABASE_URL'] as string) || 'https://mock.supabase.co'
const supabaseAnonKey = (import.meta.env['VITE_SUPABASE_ANON_KEY'] as string) || 'mock-anon-key'

if (!import.meta.env['VITE_SUPABASE_URL'] || !import.meta.env['VITE_SUPABASE_ANON_KEY']) {
  console.warn('Missing Supabase environment variables. Running in mock mode.')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => localStorage.setItem(key, value),
      removeItem: (key: string) => localStorage.removeItem(key),
    },
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
  global: {
    headers: {
      'x-app-name': 'regx-frontend',
      'x-app-version': '1.0.0',
    },
  },
})

// ── Typed helpers ────────────────────────────────────────────

export const getUser = async () => {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user
}

export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// ── Realtime channel factory ─────────────────────────────────

export const createTenantChannel = (tenantId: string, channelName: string) =>
  supabase.channel(`${tenantId}:${channelName}`)

export default supabase
