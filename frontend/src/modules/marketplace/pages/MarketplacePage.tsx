import { Grid, Power } from 'lucide-react'

export default function MarketplacePage() {
  const integrations = [
    { name: 'MercadoPago', description: 'Pasarela de pagos en línea para facturación rápida.', active: true },
    { name: 'WhatsApp Business', description: 'Envío automático de facturas digitales y notificaciones.', active: false },
    { name: 'Sian Factura Electrónica', description: 'Facturación electrónica directa ante la DIAN / entes tributarios.', active: true }
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Marketplace e Integraciones</h1>
        <p className="text-sm text-grafito-500 dark:text-grafito-400">Conecta herramientas y servicios externos con REG-X.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration, i) => (
          <div key={i} className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6 backdrop-blur-md flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-grafito-900 dark:text-white">{integration.name}</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  integration.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-grafito-100 dark:bg-grafito-800 text-grafito-500 dark:text-grafito-400'
                }`}>
                  {integration.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <p className="text-sm text-grafito-500 dark:text-grafito-400">{integration.description}</p>
            </div>
            <button className={`w-full rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
              integration.active ? 'border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10' : 'bg-brand-500 text-grafito-900 dark:text-white hover:bg-brand-600'
            }`}>
              <Power className="h-4 w-4" />
              {integration.active ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
