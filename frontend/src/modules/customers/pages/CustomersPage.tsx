import { Plus, Search, Mail, Phone, MapPin } from 'lucide-react'

export default function CustomersPage() {
  const customers = [
    { name: 'Juan Pérez', email: 'juan.perez@gmail.com', phone: '+57 312 3456789', address: 'Calle 100 #15-30, Bogotá' },
    { name: 'María Restrepo', email: 'maria.restrepo@hotmail.com', phone: '+57 315 9876543', address: 'Av. El Poblado #45-12, Medellín' },
    { name: 'Carlos Gómez', email: 'carlos.gomez@outlook.com', phone: '+57 300 1112233', address: 'Carrera 53 #74-90, Barranquilla' }
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Clientes</h1>
          <p className="text-sm text-grafito-400">Directorio y base de datos de clientes registrados.</p>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 active:scale-[0.98] transition-all">
          <Plus className="h-4 w-4" />
          Registrar Cliente
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-grafito-900/60 p-4 border border-white/5">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-grafito-800 px-3 py-2 text-white">
          <Search className="h-4 w-4 text-grafito-500" />
          <input
            placeholder="Buscar por nombre, correo, teléfono o identificación..."
            className="flex-1 bg-transparent text-sm placeholder:text-grafito-600 outline-none"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {customers.map((c, i) => (
          <div key={i} className="rounded-2xl border border-white/5 bg-grafito-900/60 p-5 backdrop-blur-md space-y-4">
            <div>
              <h3 className="font-bold text-white text-lg">{c.name}</h3>
              <p className="text-xs text-brand-400 font-semibold">Cliente Frecuente</p>
            </div>
            <div className="space-y-2 text-sm text-grafito-300">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-grafito-500" />
                <span>{c.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-grafito-500" />
                <span>{c.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-grafito-500" />
                <span className="truncate">{c.address}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
