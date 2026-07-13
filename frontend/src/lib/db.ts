/**
 * REG-X — Supabase Database Service Layer (barrel)
 * El código vive en lib/db/<dominio>.ts; este archivo solo re-exporta para
 * que todos los imports existentes de '@lib/db' sigan funcionando.
 */
export * from './db/core'
export * from './db/products'
export * from './db/customers'
export * from './db/sales'
export * from './db/inventory'
export * from './db/pos'
export * from './db/reports'
export * from './db/restaurant'
export * from './db/hr'
export * from './db/purchasing'
export * from './db/retail'
export * from './db/promotions'
export * from './db/pharmacy'
export * from './db/hardware'
export * from './db/finance'
export * from './db/platform'
export * from './db/billing'
export * from './db/tenant-settings'
export * from './db/advanced'
export * from './db/automations'
