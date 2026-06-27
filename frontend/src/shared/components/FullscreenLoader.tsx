import { motion } from 'framer-motion'

export function FullscreenLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-grafito-950">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <motion.img
          src="/logo-icon.png"
          alt="RegX"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          className="h-14 w-14 object-contain"
        />
        <p className="text-sm text-grafito-500 dark:text-grafito-400">Cargando REG-X…</p>
      </motion.div>
    </div>
  )
}
