import { Store, TrendingUp, Clock, ShieldCheck } from 'lucide-react'
import { motion } from 'framer-motion'

interface AuthLayoutProps {
  children: React.ReactNode
}

const benefits = [
  {
    icon: TrendingUp,
    title: 'Vende más, sin esfuerzo',
    desc: 'POS táctil, pagos divididos, combos y descuentos automáticos. Tus cajeros cierran ventas en segundos.',
  },
  {
    icon: Clock,
    title: 'Recupera tu tiempo',
    desc: 'Reportes automáticos, inventario en tiempo real y cierres de caja sin errores. Menos horas en la oficina.',
  },
  {
    icon: ShieldCheck,
    title: 'Crece con confianza',
    desc: 'Multi-sucursal, roles por empleado y datos cifrados. Escala de una tienda a toda una cadena.',
  },
]


export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-grafito-950">

      {/* ── Left panel ─────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[54%] flex-col justify-between relative overflow-hidden p-12">

        {/* Fondo con gradiente radial */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 70% 60% at 20% 10%, rgba(242,13,24,0.08) 0%, transparent 60%),
              radial-gradient(ellipse 50% 50% at 80% 90%, rgba(242,13,24,0.05) 0%, transparent 60%),
              #030712
            `,
          }}
        />

        {/* Grid sutil */}
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative z-10 flex items-center gap-3"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500 shadow-lg shadow-brand-500/40">
            <Store className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-black text-white text-xl tracking-tight">REG-X</p>
            <p className="text-xs text-grafito-600 font-medium">ERP / POS Enterprise</p>
          </div>
        </motion.div>

        {/* Centro */}
        <div className="relative z-10 space-y-8">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/8 px-3.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
              <span className="text-xs font-semibold text-brand-300 tracking-wide">
                +500 negocios confían en REG-X
              </span>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="space-y-3"
          >
            <h1 className="text-[2.75rem] font-black text-white leading-[1.08] tracking-tight">
              Tu negocio merece<br />
              <span className="text-brand-400">herramientas de élite.</span>
            </h1>
            <p className="text-grafito-500 text-base max-w-sm leading-relaxed">
              El sistema ERP/POS que usan los negocios que no se conforman con crecer despacio.
            </p>
          </motion.div>

          {/* Benefit cards */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.22 }}
            className="space-y-2.5"
          >
            {benefits.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.38, delay: 0.28 + i * 0.08 }}
                className="flex items-start gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-5 py-4 backdrop-blur-sm"
                style={{
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                }}
              >
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 border border-brand-500/10">
                  <Icon className="h-4 w-4 text-brand-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{title}</p>
                  <p className="text-xs text-grafito-600 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

        </div>

        {/* Footer */}
        <p className="relative z-10 text-xs text-grafito-800">
          © {new Date().getFullYear()} REG-X. Todos los derechos reservados.
        </p>
      </div>

      {/* Divider */}
      <div className="hidden lg:block w-px bg-white/[0.05]" />

      {/* ── Right panel ─────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto p-6 lg:p-10 relative">
        {/* Orbs de color para que el blur tenga algo que difuminar */}
        <div className="pointer-events-none absolute top-1/4 left-1/4 h-48 w-48 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-1/3 right-1/4 h-40 w-40 rounded-full bg-brand-700/8 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 right-1/3 h-32 w-32 rounded-full bg-grafito-700/20 blur-2xl" />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="w-full max-w-[400px] py-4"
        >
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 shadow-lg shadow-brand-500/30">
              <Store className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-white text-lg">REG-X</span>
              <p className="text-xs text-grafito-500">ERP/POS Enterprise</p>
            </div>
          </div>

          {children}
        </motion.div>
      </div>
    </div>
  )
}
