// Generador mínimo de código de barras Code128 (subconjunto B: ASCII 32-126).
// Devuelve las barras como rectángulos para dibujar en SVG. Autocontenido.

const PATTERNS: string[] = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112',
]

const START_B = 104
const STOP = 106

export interface BarcodeResult { width: number; height: number; bars: { x: number; w: number }[] }

export function code128(value: string, opts?: { height?: number; moduleW?: number }): BarcodeResult {
  const height = opts?.height ?? 48
  const moduleW = opts?.moduleW ?? 1.4
  const clean = (value || '').replace(/[^\x20-\x7E]/g, '') || ' '

  const values: number[] = [START_B]
  for (const ch of clean) values.push(ch.charCodeAt(0) - 32)

  let sum = START_B
  for (let i = 1; i < values.length; i++) sum += (values[i] ?? 0) * i
  values.push(sum % 103)
  values.push(STOP)

  const widths = values.map((v) => PATTERNS[v] ?? '').join('')
  const bars: { x: number; w: number }[] = []
  let x = 0
  for (let i = 0; i < widths.length; i++) {
    const w = parseInt(widths[i] ?? '0', 10) * moduleW
    if (i % 2 === 0) bars.push({ x, w })   // índices pares = barra negra
    x += w
  }
  return { width: Math.ceil(x), height, bars }
}

/** SVG como string (para ventana de impresión). */
export function code128SvgString(value: string, opts?: { height?: number; moduleW?: number }): string {
  const { width, height, bars } = code128(value, opts)
  const rects = bars.map((b) => `<rect x="${b.x.toFixed(2)}" y="0" width="${b.w.toFixed(2)}" height="${height}"/>`).join('')
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" fill="#000">${rects}</svg>`
}
