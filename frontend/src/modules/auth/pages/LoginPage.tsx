import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LogIn, Key, Mail, ShieldAlert } from 'lucide-react'
import { useAuthStore } from '@store/auth.store'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { setUser, setProfile, setTenant, setBranch } = useAuthStore()

  const handleDemoLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      // Fake delay
      await new Promise((resolve) => setTimeout(resolve, 800))
      
      const mockUser = {
        id: 'usr-demo',
        email: 'demo@regx.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      }

      const mockProfile = {
        id: 'usr-demo',
        email: 'demo@regx.com',
        fullName: 'Administrador Demo',
        platformRole: 'SUPER_ADMIN' as const,
        permissions: ['*'],
      }

      const mockTenant = {
        tenantId: 'tenant-demo',
        tenantName: 'REG-X Demo Corporation',
        tenantSlug: 'demo',
        plan: 'ENTERPRISE' as const,
        businessType: 'General',
      }

      const mockBranch = {
        branchId: 'branch-demo',
        branchName: 'Sucursal Principal',
        branchCode: 'MAIN-01',
        currency: 'USD',
        timezone: 'America/Bogota',
        country: 'CO',
      }

      // Populate state
      setUser(mockUser as any)
      setProfile(mockProfile)
      setTenant(mockTenant)
      setBranch(mockBranch)

      const from = (location.state as any)?.from?.pathname || '/dashboard'
      navigate(from, { replace: true })
    } catch (err) {
      setError('Fallo al iniciar sesión de demostración.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Por favor complete todos los campos')
      return
    }
    handleDemoLogin()
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
        <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
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
              className="flex-1 bg-transparent text-sm placeholder:text-grafito-600 outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-600 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          <LogIn className="h-4 w-4" />
        </button>
      </form>

      <div className="relative flex py-2 items-center">
        <div className="flex-grow border-t border-white/5"></div>
        <span className="flex-shrink mx-4 text-grafito-600 text-xs uppercase tracking-widest font-bold">O</span>
        <div className="flex-grow border-t border-white/5"></div>
      </div>

      <button
        type="button"
        onClick={handleDemoLogin}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-grafito-300 hover:bg-white/10 active:scale-[0.98] transition-all"
      >
        Entrar con Cuenta Demo
      </button>

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
