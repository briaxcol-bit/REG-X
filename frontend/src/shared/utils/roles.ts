/**
 * REG-X — Disponibilidad de roles según módulos activos del tenant.
 * ---------------------------------------------------------------
 * Algunos roles solo tienen sentido si el negocio tiene ciertos
 * módulos activos. Ej.: un Mesero/Cocinero/Bartender solo aplica
 * si el tenant tiene módulos de restaurante (mesas, KDS, barra…).
 *
 * Los roles NO listados aquí (OWNER, ADMIN, CASHIER, ACCOUNTANT,
 * INVENTORY_MANAGER, CUSTOM) se consideran universales: aplican a
 * cualquier negocio y siempre se muestran.
 */

// Rol -> al menos uno de estos módulos debe estar activo para ofrecerlo.
export const ROLE_MODULE_REQUIREMENTS: Record<string, string[]> = {
  WAITER:    ['tables', 'reservations', 'split_bill', 'menu_digital', 'bar_tabs', 'delivery'],
  CHEF:      ['kitchen_display'],
  BARTENDER: ['bar_tabs', 'kitchen_display'],
}

/**
 * ¿Está disponible este rol para el tenant?
 * - Roles universales (sin requisito): siempre true.
 * - Roles con requisito: true si alguno de sus módulos está activo.
 * - Fallback seguro: si aún no conocemos los módulos (undefined) o la
 *   lista viene vacía (tenant sin módulos sembrados), mostramos todo
 *   para no ocultar roles por error.
 */
export function isRoleAvailable(role: string, activeSlugs: string[] | undefined | null): boolean {
  // Siempre retornamos true para que muestre todos los roles (Mesero, Cocinero, etc.)
  // sin importar si tienen los módulos de restaurante activos o no.
  return true
}

/** Filtra una lista de entradas [rolKey, ...] dejando solo las disponibles. */
export function filterRoleEntries<T extends [string, unknown]>(
  entries: T[],
  activeSlugs: string[] | undefined | null,
): T[] {
  return entries.filter(([key]) => isRoleAvailable(key, activeSlugs))
}
