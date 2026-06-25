import { useState } from 'react'
import { Settings, Shield, Building, Sliders, Bell } from 'lucide-react'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general')

  const menuItems = [
    { id: 'general', name: 'General', icon: Settings },
    { id: 'business', name: 'Datos de Empresa', icon: Building },
    { id: 'roles', name: 'Roles y Permisos', icon: Shield },
    { id: 'notifications', name: 'Notificaciones', icon: Bell }
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Configuración</h1>
        <p className="text-sm text-grafito-400">Administra las preferencias y ajustes del sistema.</p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        {/* Sidebar de Configuración */}
        <div className="w-full shrink-0 md:w-64 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                activeTab === item.id
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                  : 'text-grafito-300 hover:bg-grafito-800'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </button>
          ))}
        </div>

        {/* Panel de Configuración Activo */}
        <div className="flex-1 rounded-2xl border border-white/5 bg-grafito-900/60 p-6 backdrop-blur-md space-y-4">
          <h2 className="text-lg font-bold text-white uppercase tracking-wider text-xs text-grafito-400">
            Ajustes de {menuItems.find(m => m.id === activeTab)?.name}
          </h2>
          <div className="space-y-4">
            <p className="text-sm text-grafito-300">
              La edición de configuraciones globales está bloqueada en este entorno demo.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
