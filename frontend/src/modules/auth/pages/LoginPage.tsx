import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { LogIn, Key, Mail, ShieldAlert, Eye, EyeOff, X, FileText } from 'lucide-react'
import { useAuthStore } from '@store/auth.store'
import { supabase } from '@lib/supabase'
import { resolveUserContext } from '@lib/db'
import { useTheme } from '@shared/hooks/useTheme'

// ── Glass Input wrapper ──────────────────────────────────────────────────────

function GlassInput({ children }: { children: React.ReactNode }) {
  const controls = useAnimation()
  const { isDark } = useTheme()

  const handleFocus = async () => {
    await controls.start({
      scaleX: [1, 0.97, 1.03, 0.985, 1.008, 1],
      scaleY: [1, 1.03, 0.97, 1.015, 0.992, 1],
      transition: { duration: 0.5, ease: 'easeOut' },
    })
  }

  const darkStyle = {
    background: 'rgba(255, 255, 255, 0.07)',
    border: '1px solid rgba(255, 255, 255, 0.10)',
    borderTopColor: 'rgba(255, 255, 255, 0.20)',
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 24px rgba(0,0,0,0.30)`,
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
  }

  const lightStyle = {
    background: 'linear-gradient(160deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.90) 100%)',
    border: '1px solid rgba(0,0,0,0.07)',
    borderTopColor: 'rgba(255,255,255,1)',
    boxShadow: `
      inset 0 1px 0 rgba(255,255,255,1),
      inset 0 -1px 0 rgba(0,0,0,0.04),
      0 2px 12px rgba(0,0,0,0.06),
      0 1px 3px rgba(0,0,0,0.04)
    `,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  }

  return (
    <motion.div
      animate={controls}
      onFocusCapture={handleFocus}
      className="group relative flex items-center gap-3 rounded-2xl px-4 py-3.5"
      style={isDark ? darkStyle : lightStyle}
    >
      {/* Línea de brillo superior sutil */}
      <div
        className="pointer-events-none absolute inset-x-4 top-0 h-px rounded-full"
        style={{
          background: isDark
            ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12) 40%, rgba(255,255,255,0.15) 60%, transparent)'
            : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8) 40%, rgba(255,255,255,0.9) 60%, transparent)',
        }}
      />
      {children}
    </motion.div>
  )
}

// ── Política de Tratamiento de Datos ────────────────────────────────────────

function PrivacyPolicyModal({ onClose }: { onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(3,7,18,0.85)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 p-8 shadow-2xl"
        >
          {/* Header */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10">
                <FileText className="h-5 w-5 text-brand-400" />
              </div>
              <div>
                <h2 className="font-bold text-grafito-900 dark:text-white text-lg leading-tight">
                  Política de Tratamiento de Datos Personales
                </h2>
                <p className="text-xs text-grafito-500 mt-0.5">REG-X · Ley 1581 de 2012</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-grafito-500 hover:bg-grafito-100 dark:hover:bg-white/5 hover:text-grafito-900 dark:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-5 text-sm text-grafito-600 dark:text-grafito-300 leading-relaxed">

            <section>
              <h3 className="font-semibold text-grafito-900 dark:text-white mb-2">1. Responsable del Tratamiento</h3>
              <p>
                <strong className="text-grafito-700 dark:text-grafito-200">REG-X SaaS Enterprise</strong> es el responsable del tratamiento
                de sus datos personales, en cumplimiento de la Ley Estatutaria 1581 de 2012 y el Decreto 1377 de 2013
                de la República de Colombia.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-grafito-900 dark:text-white mb-2">2. Datos Recolectados</h3>
              <p>REG-X recopila los siguientes datos al usar la plataforma:</p>
              <ul className="mt-2 space-y-1 ml-4 list-disc text-grafito-500 dark:text-grafito-400">
                <li>Nombre completo y correo electrónico</li>
                <li>Datos de autenticación (contraseña cifrada)</li>
                <li>Información del negocio y sucursales</li>
                <li>Registros de transacciones, ventas e inventario</li>
                <li>Dirección IP y datos de dispositivo para seguridad</li>
                <li>Preferencias de configuración del sistema</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-grafito-900 dark:text-white mb-2">3. Finalidades del Tratamiento</h3>
              <p>Los datos son utilizados exclusivamente para:</p>
              <ul className="mt-2 space-y-1 ml-4 list-disc text-grafito-500 dark:text-grafito-400">
                <li>Prestar y mejorar los servicios ERP/POS de la plataforma</li>
                <li>Gestionar su cuenta, suscripción y facturación</li>
                <li>Garantizar la seguridad y prevenir fraudes</li>
                <li>Enviar notificaciones operativas del sistema</li>
                <li>Generar reportes y análisis de su negocio</li>
                <li>Cumplir obligaciones legales y fiscales aplicables</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-grafito-900 dark:text-white mb-2">4. Almacenamiento y Seguridad</h3>
              <p>
                Sus datos se almacenan en servidores con cifrado AES-256, aislamiento por tenant (multitenancy),
                y protección mediante Row Level Security (RLS). Implementamos autenticación de dos factores (MFA),
                rotación de tokens y registros de auditoría completos.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-grafito-900 dark:text-white mb-2">5. Transferencia de Datos</h3>
              <p>
                REG-X no vende ni transfiere sus datos personales a terceros con fines comerciales.
                Los datos pueden compartirse únicamente con proveedores de infraestructura necesarios para
                la operación del servicio, quienes están sujetos a acuerdos de confidencialidad.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-grafito-900 dark:text-white mb-2">6. Derechos del Titular</h3>
              <p>En cumplimiento de la Ley 1581 de 2012, usted tiene derecho a:</p>
              <ul className="mt-2 space-y-1 ml-4 list-disc text-grafito-500 dark:text-grafito-400">
                <li><strong className="text-grafito-600 dark:text-grafito-300">Conocer</strong> los datos que REG-X tiene sobre usted</li>
                <li><strong className="text-grafito-600 dark:text-grafito-300">Actualizar</strong> y corregir su información personal</li>
                <li><strong className="text-grafito-600 dark:text-grafito-300">Suprimir</strong> sus datos cuando no sean necesarios</li>
                <li><strong className="text-grafito-600 dark:text-grafito-300">Revocar</strong> la autorización otorgada</li>
                <li><strong className="text-grafito-600 dark:text-grafito-300">Presentar quejas</strong> ante la Superintendencia de Industria y Comercio (SIC)</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-grafito-900 dark:text-white mb-2">7. Vigencia</h3>
              <p>
                Los datos se conservarán durante la vigencia de su contrato con REG-X y el tiempo
                adicional requerido por obligaciones legales. Al cancelar su cuenta, los datos serán
                eliminados de forma segura en un plazo máximo de 30 días hábiles.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-grafito-900 dark:text-white mb-2">8. Contacto</h3>
              <p>
                Para ejercer sus derechos o consultas sobre esta política, escríbanos a{' '}
                <a href="mailto:privacidad@regx.com" className="text-brand-400 hover:underline">
                  privacidad@regx.com
                </a>
              </p>
            </section>

            <p className="text-xs text-grafito-600 border-t border-grafito-200 dark:border-white/5 pt-4">
              Última actualización: junio de 2025. Esta política puede actualizarse; le notificaremos
              cualquier cambio relevante a través de la plataforma.
            </p>
          </div>

          <button
            onClick={onClose}
            className="mt-6 w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-grafito-900 dark:text-white hover:bg-brand-600 transition-colors"
          >
            Entendido
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Login Page ───────────────────────────────────────────────────────────────

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [acceptedPolicy, setAcceptedPolicy] = useState(
    () => localStorage.getItem('regx:policy_accepted') === '1'
  )
  const [showPolicy, setShowPolicy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEmailChange = (val: string) => setEmail(val)

  const handlePolicyChange = (checked: boolean) => {
    setAcceptedPolicy(checked)
    if (checked) localStorage.setItem('regx:policy_accepted', '1')
    else localStorage.removeItem('regx:policy_accepted')
  }

  const { setUser, setProfile, setSession, setTenant, setBranch } = useAuthStore()
  // setTenant / setBranch se usan en el fallback Supabase cuando el backend no está disponible

  const handleDemoLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      await new Promise((resolve) => setTimeout(resolve, 800))
      setUser({
        id: 'usr-demo',
        email: 'demo@regx.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as any)
      setProfile({
        id: 'usr-demo',
        email: 'demo@regx.com',
        fullName: 'Administrador Demo',
        businessRole: 'OWNER' as const,
        permissions: [],
      })
      setTenant({
        tenantId: 'tenant-demo',
        tenantName: 'REG-X Demo Corporation',
        tenantSlug: 'demo',
        plan: 'ENTERPRISE' as const,
        businessType: 'General',
      })
      setBranch({
        branchId: 'branch-demo',
        branchName: 'Sucursal Principal',
        branchCode: 'MAIN-01',
        currency: 'USD',
        timezone: 'America/Bogota',
        country: 'CO',
      })
      navigate((location.state as any)?.from?.pathname || '/dashboard', { replace: true })
    } catch {
      setError('Fallo al iniciar sesión de demostración.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Por favor completa todos los campos.')
      return
    }
    if (!acceptedPolicy) {
      setError('Acepta la Política de Tratamiento de Datos para continuar.')
      return
    }

    setLoading(true)
    setError(null)
    const from = (location.state as any)?.from?.pathname || '/dashboard'

    try {
      // ── Autenticación vía Supabase (el frontend usa el cliente Supabase + RLS) ──
      const SUPABASE_URL  = import.meta.env['VITE_SUPABASE_URL'] as string
      const SUPABASE_ANON = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string

      if (!SUPABASE_URL || !SUPABASE_ANON) {
        throw new Error('El servidor no está disponible y las credenciales de Supabase no están configuradas.')
      }

      const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey:          SUPABASE_ANON,
          Authorization:  `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify({ email, password }),
      })
      
      const raw = await tokenRes.text()
      const tokenData = raw ? JSON.parse(raw) : {}
      
      if (!tokenRes.ok || !tokenData.access_token) {
        throw new Error(tokenData.error_description ?? tokenData.msg ?? tokenData.message ?? 'Credenciales incorrectas')
      }

      // Inyectar la sesión en el cliente Supabase (necesario para que RLS funcione)
      const { data, error: sbErr } = await supabase.auth.setSession({
        access_token:  tokenData.access_token,
        refresh_token: tokenData.refresh_token,
      })
      if (sbErr || !data.user) throw new Error(sbErr?.message ?? 'Credenciales incorrectas')

      // Quitar tokens del backend para que el interceptor priorice la sesión Supabase
      localStorage.removeItem('regx:access_token')
      localStorage.removeItem('regx:refresh_token')

      setUser(data.user as any)
      setSession(data.session as any)

      // Resolver perfil/tenant/branch desde la BD (RLS activo)
      const ctx = await resolveUserContext(data.user.id)

      setProfile({
        id:        data.user.id,
        email:     data.user.email!,
        fullName:  ctx?.profile?.full_name
          ?? (data.user.user_metadata?.['full_name'] as string)
          ?? email.split('@')[0],
        permissions:  ctx?.profile?.platform_role === 'SUPER_ADMIN' ? ['*'] : [],
        platformRole: (ctx?.profile?.platform_role as any) ?? undefined,
        businessRole: ctx?.role?.role as any,
      })

      if (ctx?.tenant) {
        setTenant({
          tenantId:     ctx.tenant.id,
          tenantName:   ctx.tenant.name,
          tenantSlug:   ctx.tenant.slug,
          plan:         ctx.tenant.plan as any,
          businessType: ctx.tenant.business_type,
          logoUrl:      ctx.tenant.logo_url ?? undefined,
        })
      } else {
        setTenant(null)
      }

      if (ctx?.branch) {
        setBranch({
          branchId:   ctx.branch.id,
          branchName: ctx.branch.name,
          branchCode: ctx.branch.code,
          currency:   ctx.branch.currency ?? ctx?.tenant?.currency ?? 'USD',
          timezone:   ctx.branch.timezone ?? ctx?.tenant?.timezone ?? 'America/Bogota',
          country:    ctx?.tenant?.country ?? 'CO',
        })
      }

      // SUPER_ADMIN → panel de plataforma; el resto → su destino normal
      const dest = ctx?.profile?.platform_role === 'SUPER_ADMIN' ? '/admin' : from
      navigate(dest, { replace: true })
    } catch (err: any) {
      setError(err?.message ?? 'Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {showPolicy && <PrivacyPolicyModal onClose={() => setShowPolicy(false)} />}

      <div className="space-y-5">
        {/* Heading */}
        <div>
          <h2 className="text-[1.6rem] font-black tracking-tight text-grafito-900 dark:text-white leading-tight">
            Bienvenido de nuevo
          </h2>
          <p className="text-sm text-grafito-500 mt-1">
            Ingresa tus credenciales para acceder al panel.
          </p>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2.5 rounded-xl border border-red-500/20 bg-red-50 dark:bg-red-500/8 px-3.5 py-2.5 text-xs text-red-500 dark:text-red-400">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)} className="shrink-0 opacity-50 hover:opacity-100">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Email */}
          <GlassInput>
            <Mail className="h-4 w-4 shrink-0 text-grafito-400 dark:text-white/25 group-focus-within:text-brand-500 transition-colors" />
            <input
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="Correo electrónico"
              autoComplete="email"
              className="flex-1 min-w-0 text-sm text-grafito-900 dark:text-white placeholder:text-grafito-400 dark:placeholder:text-white/30 outline-none"
              style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}
            />
          </GlassInput>

          {/* Password */}
          <GlassInput>
            <Key className="h-4 w-4 shrink-0 text-grafito-400 dark:text-white/25 group-focus-within:text-brand-500 transition-colors" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              autoComplete="current-password"
              className="flex-1 min-w-0 text-sm text-grafito-900 dark:text-white placeholder:text-grafito-400 dark:placeholder:text-white/30 outline-none"
              style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="shrink-0 text-grafito-400 dark:text-white/25 hover:text-grafito-600 dark:hover:text-white/60 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </GlassInput>

          {/* Forgot + Policy row */}
          <div className="flex items-start justify-between gap-3">
            <label className="flex items-start gap-2 cursor-pointer group select-none flex-1">
              <div className="mt-0.5 shrink-0">
                <input
                  type="checkbox"
                  checked={acceptedPolicy}
                  onChange={(e) => handlePolicyChange(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="h-4 w-4 rounded-[5px] border border-grafito-300 dark:border-white/15 bg-white dark:bg-white/5 peer-checked:bg-brand-500 peer-checked:border-brand-500 transition-all flex items-center justify-center shadow-sm">
                  {acceptedPolicy && (
                    <svg className="h-2.5 w-2.5 text-grafito-900 dark:text-white" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-[11px] text-grafito-500 dark:text-grafito-600 leading-relaxed">
                Acepto la{' '}
                <button
                  type="button"
                  onClick={() => setShowPolicy(true)}
                  className="text-brand-500 dark:text-brand-400 hover:text-brand-600 underline underline-offset-2 font-medium transition-colors"
                >
                  Política de Datos
                </button>{' '}
                (Ley 1581/2012)
              </span>
            </label>

            <button
              type="button"
              onClick={() => navigate('/auth/forgot')}
              className="shrink-0 text-[11px] text-grafito-500 dark:text-grafito-600 hover:text-brand-500 dark:hover:text-brand-400 transition-colors whitespace-nowrap"
            >
              ¿Olvidaste tu clave?
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-brand-500 py-3.5 text-sm font-bold text-grafito-900 dark:text-white transition-all hover:bg-brand-600 active:scale-[0.98] shadow-lg shadow-brand-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:translate-x-full transition-transform duration-700" />
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Iniciando sesión...
              </>
            ) : (
              <>
                Iniciar Sesión
                <LogIn className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-grafito-200 dark:border-white/5" />
          <span className="text-[10px] text-grafito-500 dark:text-grafito-700 font-bold uppercase tracking-widest">o continúa con</span>
          <div className="flex-1 border-t border-grafito-200 dark:border-white/5" />
        </div>

        {/* Demo button */}
        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-grafito-200 dark:border-white/[0.07] bg-grafito-50 dark:bg-white/[0.03] py-3 text-sm font-semibold text-grafito-600 dark:text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/[0.07] hover:text-grafito-900 dark:hover:text-white active:scale-[0.98] transition-all disabled:opacity-50"
        >
          Cuenta Demo — acceso sin registro
        </button>

        {/* Register */}
        <p className="text-center text-[11px] text-grafito-500 dark:text-grafito-400">
          ¿No tienes cuenta?{' '}
          <button
            onClick={() => navigate('/auth/register')}
            className="text-brand-500 dark:text-brand-400 hover:text-brand-600 font-semibold transition-colors"
          >
            Regístrate gratis
          </button>
        </p>
      </div>
    </>
  )
}
