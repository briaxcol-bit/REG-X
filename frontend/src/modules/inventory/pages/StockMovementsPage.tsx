import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function StockMovementsPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/inventory')}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Movimientos de Stock</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">Registro histórico de entradas, salidas y ajustes de inventario.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6 backdrop-blur-md overflow-hidden">
        <table className="w-full text-left text-sm text-grafito-600 dark:text-grafito-300">
          <thead>
            <tr className="text-xs font-semibold text-grafito-500 uppercase border-b border-grafito-200 dark:border-white/5 pb-2">
              <th className="pb-3">Fecha</th>
              <th className="pb-3">Producto</th>
              <th className="pb-3">Tipo</th>
              <th className="pb-3">Cantidad</th>
              <th className="pb-3">Usuario</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {[
              { date: '24 Jun 2026, 14:32', product: 'Hamburguesa Triple REG-X', type: 'Venta', qty: '-1', user: 'Caja Principal' },
              { date: '24 Jun 2026, 11:15', product: 'Refresco Cola Zero 500ml', type: 'Entrada (Compra)', qty: '+24', user: 'Admin' },
              { date: '23 Jun 2026, 18:00', product: 'Ensalada César Premium', type: 'Ajuste (Descarte)', qty: '-2', user: 'Chef' }
            ].map((m, i) => (
              <tr key={i} className="hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors">
                <td className="py-3">{m.date}</td>
                <td className="py-3 font-semibold text-grafito-900 dark:text-white">{m.product}</td>
                <td className="py-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    m.type.includes('Entrada') ? 'bg-emerald-500/10 text-emerald-400' :
                    m.type.includes('Ajuste') ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    {m.type}
                  </span>
                </td>
                <td className={`py-3 font-bold ${m.qty.startsWith('-') ? 'text-red-400' : 'text-emerald-400'}`}>
                  {m.qty}
                </td>
                <td className="py-3">{m.user}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
