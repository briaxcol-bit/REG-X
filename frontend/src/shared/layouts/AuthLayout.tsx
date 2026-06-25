import { Store } from 'lucide-react'
import { motion } from 'framer-motion'

interface AuthLayoutProps {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen w-full bg-grafito-950">
      {/* ── Left panel ─────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-grafito-900 p-12 border-r border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500">
            <Store className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-lg">REG-X</p>
            <p className="text-xs text-grafito-400">ERP/POS SaaS Enterprise</p>
          </div>
        </div>

        <div className="space-y-6">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-white leading-tight"
          >
            La plataforma ERP/POS
            <br />
            <span className="text-brand-400">más completa</span>
            <br />
            para tu negocio.
          </motion.h1>
          <p className="text-grafito-400 text-lg max-w-md">
            Gestiona ventas, inventario, restaurante, caja y más.
            Desde una tienda hasta una cadena multinacional.
          </p>

          <div className="flex flex-wrap gap-3">
            {['POS Touch', 'Inventario', 'Restaurante', 'Reportes', 'Multi-sucursal', 'Offline'].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-grafito-300"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <p className="text-xs text-grafito-600">
          © {new Date().getFullYear()} REG-X. Todos los derechos reservados.
        </p>
      </div>

      {/* ── Right panel ─────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500">
              <Store className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-white text-lg">REG-X</span>
          </div>
          {children}
        </motion.div>
      </div>
    </div>
  )
}
