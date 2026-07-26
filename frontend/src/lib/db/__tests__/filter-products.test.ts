import { describe, it, expect } from 'vitest'
import { filterProductsBySearch, type ProductRow } from '../products'

const row = (partial: Partial<ProductRow>): ProductRow => ({
  id: 'x', tenant_id: 't', name: '', sku: '', barcode: null,
  price: 0, cost_price: null, tax: 0, image_url: null, status: 'ACTIVE',
  track_inventory: true, category_id: null,
  ...partial,
})

const catalog: ProductRow[] = [
  row({ id: '1', name: 'Café Americano',   sku: 'CAF-001' }),
  row({ id: '2', name: 'Coca-Cola 350ml',  sku: 'BEB-350', barcode: '7701234567890' }),
  row({ id: '3', name: 'Coca-Cola 1.5L',   sku: 'BEB-150' }),
  row({ id: '4', name: 'Té verde',         sku: 'TE-001', categories: { name: 'Bebidas calientes', color: '#000' } }),
  row({ id: '5', name: 'Pan francés',      sku: 'PAN-001' }),
]

describe('filterProductsBySearch', () => {
  it('sin término devuelve todo tal cual', () => {
    expect(filterProductsBySearch(catalog, undefined)).toHaveLength(5)
    expect(filterProductsBySearch(catalog, '   ')).toHaveLength(5)
  })

  it('ignora tildes en ambas direcciones', () => {
    expect(filterProductsBySearch(catalog, 'cafe').map(r => r.id)).toEqual(['1'])
    expect(filterProductsBySearch(catalog, 'té').map(r => r.id)).toContain('4')
    expect(filterProductsBySearch(catalog, 'frances').map(r => r.id)).toEqual(['5'])
  })

  it('multi-palabra en cualquier orden (todas deben estar)', () => {
    expect(filterProductsBySearch(catalog, 'coca 350').map(r => r.id)).toEqual(['2'])
    expect(filterProductsBySearch(catalog, '350 coca').map(r => r.id)).toEqual(['2'])
  })

  it('prioriza coincidencia total; si no hay, cae a coincidencia parcial', () => {
    // 'coca 350' → solo la de 350 (match total), no la de 1.5L
    expect(filterProductsBySearch(catalog, 'coca 350')).toHaveLength(1)
    // 'coca zzz' → nadie tiene ambas; fallback: al menos una palabra
    const laxa = filterProductsBySearch(catalog, 'coca zzz')
    expect(laxa.map(r => r.id).sort()).toEqual(['2', '3'])
  })

  it('busca también por sku, código de barras y nombre de categoría', () => {
    expect(filterProductsBySearch(catalog, 'BEB-350').map(r => r.id)).toEqual(['2'])
    expect(filterProductsBySearch(catalog, '7701234567890').map(r => r.id)).toEqual(['2'])
    expect(filterProductsBySearch(catalog, 'calientes').map(r => r.id)).toEqual(['4'])
  })

  it('mayúsculas/minúsculas indistintas', () => {
    expect(filterProductsBySearch(catalog, 'CAFÉ AMERICANO').map(r => r.id)).toEqual(['1'])
  })
})
