import { Link } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <AlertCircle className="h-16 w-16 text-brand-500 animate-bounce" />
      <h1 className="text-4xl font-extrabold text-grafito-900 dark:text-white">404</h1>
      <p className="text-grafito-500 dark:text-grafito-400 max-w-md">La página que estás buscando no existe o ha sido movida.</p>
      <Link
        to="/dashboard"
        className="mt-2 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-grafito-900 dark:text-white hover:bg-brand-600 transition-colors"
      >
        Ir al Dashboard
      </Link>
    </div>
  )
}
