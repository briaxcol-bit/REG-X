import { motion } from 'framer-motion'
import { Package, RefreshCw, AlertTriangle, ArrowRightLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function InventoryPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Inventario</h1>
          <p className="text-sm text-grafito-400">Control de stock, alertas y movimientos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/inventory/movements"
            className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-grafito-800 px-4 py-2.5 text-sm text-grafito-300 hover:bg-grafito-700 transition-all"
          >
            <RefreshCw className="h-4 w-4" />
            Movimientos
          </Link>
          <Link
            to="/inventory/transfers"
            className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-all"
          >
            <ArrowRightLeft className="h-4 w-4" />
            Transferencias
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Alertas de Stock */}
        <div className="rounded-2xl border border-white/5 bg-grafito-900/60 p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Alertas de Stock Bajo</h3>
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="space-y-3">
            {[
              { name: 'Ensalada César Premium', stock: 5, min: 10 },
              { name: 'Hamburguesa Triple REG-X', stock: 8, min: 15 }
            ].map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-grafito-800/40 p-3 border border-white/5">
                <div>
                  <p className="text-sm font-semibold text-white">{p.name}</p>
                  <p className="text-[10px] text-grafito-400">Mínimo sugerido: {p.min} unidades</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-yellow-400">{p.stock} uds</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resumen de Valor de Inventario */}
        <div className="rounded-2xl border border-white/5 bg-grafito-900/60 p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Valoración del Inventario</h3>
            <Package className="h-5 w-5 text-brand-400" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-sm text-grafito-400">Costo total de inventario:</span>
              <span className="text-sm font-bold text-white">$4,850.00</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-sm text-grafito-400">Venta estimada de inventario:</span>
              <span className="text-sm font-bold text-brand-400">$8,240.00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-grafito-400">Margen promedio estimado:</span>
              <span className="text-sm font-bold text-emerald-400">41.14%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
