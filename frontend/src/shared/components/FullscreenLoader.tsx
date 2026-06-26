import { motion } from 'framer-motion'
import { Store } from 'lucide-react'

export function FullscreenLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-grafito-950">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500"
        >
          <Store className="h-7 w-7 text-grafito-900 dark:text-white" />
        </motion.div>
        <p className="text-sm text-grafito-500 dark:text-grafito-400">Cargando REG-X…</p>
      </motion.div>
    </div>
  )
}
