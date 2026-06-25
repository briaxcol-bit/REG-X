import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LogIn, Key, Mail, ShieldAlert } from 'lucide-react'
import { useAuthStore } from '@store/auth.store'
import { api } from '@lib/api'

interface LoginResponse {
  data: {
    tokens: {
      accessToken:  string
      refreshToken: string
      expiresIn:    number
    }
    user: {
      id:       string
      email:    string
      fullName: string
    }
  }
}

export default function LoginPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const { setUser, setProfile, setSession } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Por favor completa todos los campos')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await api.post<LoginResponse>('/auth/login', { email, password })
      const { tokens, user } = res.data.data

      // Guardar tokens
      localStorage.setItem('regx:access_token',  tokens.accessToken)
      localStorage.setItem('regx:refresh_token', tokens.refreshToken)

      // Poblar store
      setUser({
        id:             user.id,
        email:          user.email,
        app_metadata:   {},
        user_metadata:  { full_name: user.fullName },
        aud:            'authenticated',
        created_at:     new Date().toISOString(),
      } as any)

      setProfile({
        id:          user.id,
        email:       user.email,
        fullName:    user.fullName,
        permissions: [],
      })

      setSession(null) // la sesión se maneja via JWT propio

      const from = (location.state as any)?.from?.pathname || '/dashboard'
      navigate(from, { replace: true })

    } catch (err: any) {
      const msg = err?.response?.data?.message
      if (Array.isArray(msg)) {
        setError(msg.join(', '))
      } else {
        setError(msg ?? 'Credenciales incorrectas')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Bienvenido de nuevo
        </h2>
        <p className="text-sm text-grafito-400">
          Ingresa tus credenciales para acceder a tu panel.
        </p>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400"
        >
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-grafito-400 uppercase tracking-wider">
            Correo Electrónico
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-grafito-900 px-3.5 py-2.5 text-white focus-within:border-brand-500 transition-colors">
            <Mail className="h-4 w-4 text-grafito-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              autoComplete="email"
              className="flex-1 bg-transparent text-sm placeholder:text-grafito-600 outline-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-grafito-400 uppercase tracking-wider">
              Contraseña
            </label>
            <button
              type="button"
              onClick={() => navigate('/auth/forgot')}
              className="text-xs text-brand-400 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-grafito-900 px-3.5 py-2.5 text-white focus-within:border-brand-500 transition-colors">
            <Key className="h-4 w-4 text-grafito-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="flex-1 bg-transparent text-sm placeholder:text-grafito-600 outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-600 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {loading ? 'Verificando...' : 'Iniciar Sesión'}
          <LogIn className="h-4 w-4" />
        </button>
      </form>

      <p className="text-center text-xs text-grafito-500">
        ¿No tienes una cuenta?{' '}
        <button
          onClick={() => navigate('/auth/register')}
          className="text-brand-400 hover:underline font-semibold"
        >
          Regístrate gratis
        </button>
      </p>
    </div>
  )
}
