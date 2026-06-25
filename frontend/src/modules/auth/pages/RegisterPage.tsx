import { useNavigate } from 'react-router-dom'

export default function RegisterPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-grafito-900 dark:text-white">
          Crear una cuenta
        </h2>
        <p className="text-sm text-grafito-500 dark:text-grafito-400">
          Regístrate para comenzar a usar la plataforma REG-X.
        </p>
      </div>

      <div className="rounded-xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900 p-6 text-center space-y-4">
        <p className="text-sm text-grafito-600 dark:text-grafito-300">
          El registro de nuevos clientes está deshabilitado en este entorno de demostración.
        </p>
        <button
          onClick={() => navigate('/auth/login')}
          className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-grafito-900 dark:text-white hover:bg-brand-600 transition-colors"
        >
          Volver al Login
        </button>
      </div>
    </div>
  )
}
