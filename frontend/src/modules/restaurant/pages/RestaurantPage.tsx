import { Link } from 'react-router-dom'
import { Utensils, Monitor } from 'lucide-react'

export default function RestaurantPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Módulo Restaurante</h1>
        <p className="text-sm text-grafito-400">Gestión de mesas, comandas y despacho a cocina.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Link
          to="/restaurant/tables"
          className="flex flex-col justify-between rounded-2xl border border-white/5 bg-grafito-900/60 p-6 backdrop-blur-md hover:border-brand-500/30 transition-all space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white">Mapa de Mesas</h3>
            <Utensils className="h-5 w-5 text-brand-400" />
          </div>
          <p className="text-sm text-grafito-400">Visualiza y administra el estado de las mesas de tu salón en tiempo real.</p>
        </Link>

        <Link
          to="/kds"
          className="flex flex-col justify-between rounded-2xl border border-white/5 bg-grafito-900/60 p-6 backdrop-blur-md hover:border-brand-500/30 transition-all space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white">Pantalla de Cocina (KDS)</h3>
            <Monitor className="h-5 w-5 text-blue-400" />
          </div>
          <p className="text-sm text-grafito-400">Pantalla de pedidos de cocina para preparación y despacho rápido.</p>
        </Link>
      </div>
    </div>
  )
}
