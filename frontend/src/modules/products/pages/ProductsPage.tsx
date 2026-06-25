import { Link } from 'react-router-dom'
import { Plus, Search, Tag, Eye } from 'lucide-react'

export default function ProductsPage() {
  const products = [
    { id: '1', name: 'Hamburguesa Triple REG-X', sku: 'PROD-001', price: 12.99, stock: 25, status: 'Activo' },
    { id: '2', name: 'Papas Fritas Crujientes L', sku: 'PROD-002', price: 4.50, stock: 50, status: 'Activo' },
    { id: '3', name: 'Refresco Cola Zero 500ml', sku: 'PROD-003', price: 2.50, stock: 120, status: 'Activo' },
    { id: '4', name: 'Pizza Pepperoni Familiar', sku: 'PROD-004', price: 18.90, stock: 12, status: 'Activo' }
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Productos</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">Catálogo general de tus artículos y servicios.</p>
        </div>
        <Link
          to="/products/new"
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-grafito-900 dark:text-white hover:bg-brand-600 active:scale-[0.98] transition-all"
        >
          <Plus className="h-4 w-4" />
          Nuevo Producto
        </Link>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white dark:bg-grafito-900/60 p-4 rounded-xl border border-grafito-200 dark:border-white/5">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-grafito-100 dark:bg-grafito-800 px-3 py-2 text-grafito-900 dark:text-white">
          <Search className="h-4 w-4 text-grafito-500" />
          <input
            placeholder="Buscar por nombre, SKU o código de barra..."
            className="flex-1 bg-transparent text-sm placeholder:text-grafito-400 dark:placeholder:text-grafito-600 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/products/categories"
            className="flex items-center gap-1.5 rounded-lg border border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 px-3.5 py-2 text-xs text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-all"
          >
            <Tag className="h-3.5 w-3.5" />
            Categorías
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6 backdrop-blur-md overflow-hidden">
        <table className="w-full text-left text-sm text-grafito-600 dark:text-grafito-300">
          <thead>
            <tr className="text-xs font-semibold text-grafito-500 uppercase border-b border-grafito-200 dark:border-white/5 pb-2">
              <th className="pb-3">Nombre</th>
              <th className="pb-3">SKU</th>
              <th className="pb-3">Precio</th>
              <th className="pb-3">Stock</th>
              <th className="pb-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors">
                <td className="py-3.5 font-semibold text-grafito-900 dark:text-white">{p.name}</td>
                <td className="py-3.5 font-mono text-xs">{p.sku}</td>
                <td className="py-3.5 text-brand-400 font-bold">${p.price.toFixed(2)}</td>
                <td className="py-3.5">{p.stock} uds</td>
                <td className="py-3.5 text-right">
                  <Link
                    to={`/products/${p.id}/edit`}
                    className="inline-flex items-center gap-1 text-xs text-brand-400 hover:underline"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
