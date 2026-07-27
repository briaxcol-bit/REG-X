/**
 * Detección heurística de "imagen con fondo blanco".
 *
 * Muestrea el BORDE de la imagen (primera/última fila y columna): si casi
 * todos esos píxeles son blancos o casi blancos, el producto está recortado
 * sobre fondo blanco — el estándar del catálogo maestro.
 *
 * No es infalible (una caja blanca a sangre puede dar falso positivo), por eso
 * la UI siempre muestra la miniatura para que el humano decida.
 */
export type WhiteBgResult = 'white' | 'not-white' | 'error'

export async function hasWhiteBackground(
  url: string,
  opts?: { threshold?: number; minRatio?: number },
): Promise<WhiteBgResult> {
  const threshold = opts?.threshold ?? 238   // 0-255: qué tan claro cuenta como blanco
  const minRatio  = opts?.minRatio ?? 0.88   // % del borde que debe ser blanco

  return new Promise<WhiteBgResult>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onerror = () => resolve('error')
    img.onload = () => {
      try {
        const S = 48                        // se analiza a baja resolución: rápido
        const canvas = document.createElement('canvas')
        canvas.width = S; canvas.height = S
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) { resolve('error'); return }
        ctx.drawImage(img, 0, 0, S, S)
        const { data } = ctx.getImageData(0, 0, S, S)

        const isWhite = (i: number) => {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
          if (a < 16) return true                    // transparente = fondo limpio
          return r >= threshold && g >= threshold && b >= threshold
        }

        let total = 0, whites = 0
        const check = (x: number, y: number) => {
          const i = (y * S + x) * 4
          total++
          if (isWhite(i)) whites++
        }
        for (let x = 0; x < S; x++) { check(x, 0); check(x, S - 1) }
        for (let y = 1; y < S - 1; y++) { check(0, y); check(S - 1, y) }

        resolve(whites / total >= minRatio ? 'white' : 'not-white')
      } catch {
        // getImageData falla si el servidor no envía cabeceras CORS
        resolve('error')
      }
    }
    img.src = url
  })
}
