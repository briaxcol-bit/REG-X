/**
 * REG-X — Configuración de cobro / facturación (COBRO MANUAL)
 * ------------------------------------------------------------
 * Edita estos datos con tu información real. La página de
 * Suscripción del dueño los muestra para que te paguen y
 * abre WhatsApp para avisarte del comprobante.
 *
 * Cuando integres una pasarela (Wompi, MercadoPago…), este es el
 * único lugar que necesitarás cambiar en el flujo del dueño.
 */

export const BILLING = {
  /** Nombre que verá el cliente como beneficiario del pago. */
  beneficiary: 'REG-X SAS',

  /** Número de WhatsApp de soporte/pagos en formato internacional SIN "+" ni espacios. Ej: 573001112233 */
  whatsapp: '573334001766',

  /** Correo de soporte/pagos. */
  email: 'regx.poos@gmail.com',

  /** Métodos de pago manuales que mostrará la página. Deja vacío el array para ocultarlos. */
  methods: [
    { label: 'Nequi / Daviplata', value: '3334001766' },
    { label: 'Bancolombia (Ahorros)', value: 'xxxxxxxx' },
    { label: 'Llave (Transfiya)', value: '@bab379' },
  ] as { label: string; value: string }[],

  /**
   * true  = pasarela automática habilitada (aún no implementada aquí).
   * false = cobro manual (estado actual).
   */
  gatewayEnabled: false,
}

/**
 * Configuración de Wompi (Checkout por período).
 * - La llave PÚBLICA va en el frontend (VITE_WOMPI_PUBLIC_KEY).
 * - La llave privada, el secreto de integridad y el de eventos van en
 *   los secretos de las Edge Functions, NUNCA aquí.
 * - `enabled` se activa solo si hay llave pública configurada.
 */
export const WOMPI = {
  enabled: Boolean(import.meta.env['VITE_WOMPI_PUBLIC_KEY']),
  publicKey: (import.meta.env['VITE_WOMPI_PUBLIC_KEY'] as string) ?? '',
  // 'sandbox' | 'production' (solo informativo; el prefijo de la llave manda)
  env: (import.meta.env['VITE_WOMPI_ENV'] as string) ?? 'sandbox',
}
