/**
 * BarcodeScanner — escáner de código de barras para POS.
 *
 * Modos:
 *  · camera   — usa la BarcodeDetector API con cámara trasera. En Chrome Android/Desktop
 *               usa el detector nativo; en iOS Safari (y otros sin soporte) se activa el
 *               polyfill WASM importado arriba, así que la cámara funciona igual.
 *               Requiere HTTPS para acceder a la cámara.
 *  · keyboard — campo de texto; acepta tanto teclado físico como pistola USB/Bluetooth.
 */

// Polyfill de BarcodeDetector (WASM) para navegadores sin soporte nativo,
// principalmente iOS Safari. En Chrome Android/Desktop usa el nativo.
// Debe importarse antes de leer window.BarcodeDetector.
import '@preflower/barcode-detector-polyfill'
import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Barcode, Keyboard, Camera, CameraOff, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@shared/utils/cn'

// ── BarcodeDetector API (no está en TS lib por defecto) ────────
declare class BarcodeDetector {
  constructor(options?: { formats?: string[] })
  detect(image: ImageBitmapSource): Promise<Array<{ rawValue: string; format: string }>>
  static getSupportedFormats(): Promise<string[]>
}

const isBarcodeDetectorSupported = () =>
  typeof window !== 'undefined' && 'BarcodeDetector' in window

// ── Props ──────────────────────────────────────────────────────
interface BarcodeScannerProps {
  open: boolean
  onClose: () => void
  onScan: (barcode: string) => void
}

// ── Componente ─────────────────────────────────────────────────
export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const supportsCamera = isBarcodeDetectorSupported()

  const [mode, setMode]          = useState<'camera' | 'keyboard'>(supportsCamera ? 'camera' : 'keyboard')
  const [manualInput, setManual] = useState('')
  const [camError, setCamError]  = useState<string | null>(null)
  const [scanning, setScanning]  = useState(false)

  const videoRef    = useRef<HTMLVideoElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const rafRef      = useRef<number | null>(null)
  const detectorRef = useRef<BarcodeDetector | null>(null)
  const inputRef    = useRef<HTMLInputElement>(null)

  // ── Limpiar cámara ─────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (rafRef.current)    { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    setScanning(false)
  }, [])

  // ── Iniciar cámara ─────────────────────────────────────────
  const startCamera = useCallback(async () => {
    if (!supportsCamera) return
    setCamError(null)
    setScanning(false)   // reset — spinner visible hasta que el stream arranque

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      if (!detectorRef.current) {
        detectorRef.current = new BarcodeDetector({
          formats: [
            'code_128', 'code_39', 'ean_13', 'ean_8',
            'upc_a', 'upc_e', 'qr_code', 'itf',
          ],
        })
      }

      setScanning(true)

      const detect = async () => {
        if (!videoRef.current || !detectorRef.current || !streamRef.current) return
        try {
          const results = await detectorRef.current.detect(videoRef.current)
          if (results.length > 0 && results[0]?.rawValue) {
            stopCamera()
            onScan(results[0].rawValue)
            return
          }
        } catch { /* frame no disponible todavía */ }
        rafRef.current = requestAnimationFrame(detect)
      }
      rafRef.current = requestAnimationFrame(detect)

    } catch (err: unknown) {
      const e = err as { name?: string }
      const msg = e?.name === 'NotAllowedError'
        ? 'Permiso de cámara denegado. Actívalo en la configuración del navegador.'
        : 'No se pudo acceder a la cámara.'
      setCamError(msg)
      setScanning(false)
    }
  }, [supportsCamera, onScan, stopCamera])

  // Ciclo de vida: abrir/cerrar modal
  useEffect(() => {
    if (!open) {
      stopCamera()
      setManual('')
      setCamError(null)
      return
    }
    if (mode === 'camera')   startCamera()
    if (mode === 'keyboard') setTimeout(() => inputRef.current?.focus(), 100)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode])

  // Limpiar al desmontar
  useEffect(() => () => stopCamera(), [stopCamera])

  // Cambiar modo
  const switchMode = (m: 'camera' | 'keyboard') => {
    stopCamera()
    setCamError(null)
    setMode(m)
  }

  // Enviar manual
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualInput.trim()) { onScan(manualInput.trim()); setManual('') }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="w-full max-w-sm rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-grafito-100 dark:border-white/5">
              <div className="flex items-center gap-2">
                <Barcode className="h-5 w-5 text-brand-500" />
                <h3 className="font-semibold text-grafito-900 dark:text-white">Escanear código</h3>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs de modo */}
            <div className="flex gap-1 p-3 border-b border-grafito-100 dark:border-white/5">
              {supportsCamera && (
                <button
                  onClick={() => switchMode('camera')}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                    mode === 'camera'
                      ? 'bg-brand-500 text-white'
                      : 'bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700',
                  )}
                >
                  <Camera className="h-3.5 w-3.5" />
                  Cámara
                </button>
              )}
              <button
                onClick={() => switchMode('keyboard')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                  mode === 'keyboard'
                    ? 'bg-brand-500 text-white'
                    : 'bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700',
                )}
              >
                <Keyboard className="h-3.5 w-3.5" />
                Manual / Pistola
              </button>
            </div>

            {/* Contenido */}
            <div className="p-4">
              {mode === 'camera' ? (
                <div className="space-y-3">
                  {/* Visor */}
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black">
                    <video
                      ref={videoRef}
                      muted
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover"
                    />

                    {/* Reticula de escaneo */}
                    {scanning && !camError && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="relative w-52 h-28">
                          {(['tl', 'tr', 'bl', 'br'] as const).map(c => (
                            <span
                              key={c}
                              className={cn(
                                'absolute w-5 h-5 border-brand-400',
                                c === 'tl' && 'top-0 left-0 border-t-2 border-l-2',
                                c === 'tr' && 'top-0 right-0 border-t-2 border-r-2',
                                c === 'bl' && 'bottom-0 left-0 border-b-2 border-l-2',
                                c === 'br' && 'bottom-0 right-0 border-b-2 border-r-2',
                              )}
                            />
                          ))}
                          <motion.div
                            className="absolute left-1 right-1 h-0.5 bg-brand-400/90 rounded-full shadow-[0_0_8px_2px_rgba(255,70,40,0.5)]"
                            animate={{ top: ['8%', '88%', '8%'] }}
                            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Spinner inicial */}
                    {!scanning && !camError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <p className="text-xs">Iniciando cámara...</p>
                      </div>
                    )}

                    {/* Error de camara */}
                    {camError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 p-4 text-center">
                        <CameraOff className="h-8 w-8 text-red-400" />
                        <p className="text-xs text-white/80">{camError}</p>
                        <button
                          onClick={startCamera}
                          className="mt-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Reintentar
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-center text-xs text-grafito-400 dark:text-grafito-500">
                    Apunta la cámara al código de barras del producto
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <p className="text-xs text-grafito-400 dark:text-grafito-500">
                    Escribe el SKU o conecta la pistola de escaneo y apunta al producto.
                  </p>
                  <input
                    ref={inputRef}
                    value={manualInput}
                    onChange={e => setManual(e.target.value)}
                    placeholder="Código de barras o SKU..."
                    className="w-full rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-grafito-800 px-4 py-3 text-sm font-mono text-grafito-900 dark:text-white placeholder:text-grafito-400 outline-none focus:border-brand-500 transition-colors"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <button
                    type="submit"
                    disabled={!manualInput.trim()}
                    className="w-full rounded-xl bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Buscar producto
                  </button>
                </form>
              )}

              {/* Aviso si el navegador no soporta BarcodeDetector */}
              {!supportsCamera && mode === 'keyboard' && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Este navegador no permitió abrir la cámara. Usa el modo Manual / Pistola,
                    o abre la app en Safari (iOS) o Chrome (Android) sobre una conexión segura (HTTPS).
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
