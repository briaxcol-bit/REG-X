import { useNavigate } from 'react-router-dom'

export default function MFAPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Doble Factor (MFA)
        </h2>
        <p className="text-sm text-grafito-400">
          Verifica tu identidad ingresando el código de tu aplicación autenticadora.
        </p>
      </div>

      <div className="rounded-xl border border-white/5 bg-grafito-900 p-6 text-center space-y-4">
        <p className="text-sm text-grafito-300">
          La verificación MFA está deshabilitada en este entorno demo.
        </p>
        <button
          onClick={() => navigate('/auth/login')}
          className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
        >
          Volver al Login
        </button>
      </div>
    </div>
  )
}
