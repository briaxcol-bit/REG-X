import { CreditCard, Check } from 'lucide-react'

export default function SubscriptionsPage() {
  const plans = [
    { name: 'Plan Básico', price: '$29/mes', features: ['1 Sucursal', 'Hasta 500 productos', 'Soporte estándar'] },
    { name: 'Plan Profesional', price: '$59/mes', features: ['Hasta 3 Sucursales', 'Productos ilimitados', 'Módulo de restaurante', 'Soporte prioritario'] },
    { name: 'Plan Enterprise', price: '$129/mes', features: ['Sucursales ilimitadas', 'Módulo KDS avanzado', 'API de integración', 'Soporte dedicado 24/7'] }
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Suscripciones</h1>
          <p className="text-sm text-grafito-400">Planes de pago y estado de facturación de tu cuenta.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 text-xs text-emerald-400 font-semibold">
          <CreditCard className="h-4 w-4" />
          Plan Actual: Enterprise
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((p, i) => (
          <div key={i} className="rounded-2xl border border-white/5 bg-grafito-900/60 p-6 backdrop-blur-md flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-white text-lg">{p.name}</h3>
                <p className="text-2xl font-extrabold text-brand-400 mt-2">{p.price}</p>
              </div>
              <ul className="space-y-2.5 text-sm text-grafito-300">
                {p.features.map((f, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-grafito-300 hover:bg-white/10 transition-all">
              {p.name.includes('Enterprise') ? 'Plan Actual' : 'Cambiar Plan'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
