// Setup global de tests.
// Variables de entorno mínimas para que el cliente de Supabase se construya
// en modo mock (ver lib/supabase.ts) sin tocar la red.
import '@testing-library/jest-dom/vitest'

// jsdom ya provee localStorage; este stub cubre entornos donde falte.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>()
  // @ts-expect-error — shim mínimo
  globalThis.localStorage = {
    getItem:    (k: string) => store.get(k) ?? null,
    setItem:    (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear:      () => { store.clear() },
    key:        (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  }
}
