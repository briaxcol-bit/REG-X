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
  whatsapp: '573000000000',

  /** Correo de soporte/pagos. */
  email: 'pagos@regx.co',

  /** Métodos de pago manuales que mostrará la página. Deja vacío el array para ocultarlos. */
  methods: [
    { label: 'Nequi / Daviplata', value: '300 000 0000' },
    { label: 'Bancolombia (Ahorros)', value: '000-000000-00' },
    { label: 'Llave (Transfiya)', value: '@regx' },
  ] as { label: string; value: string }[],

  /**
   * true  = pasarela automática habilitada (aún no implementada aquí).
   * false = cobro manual (estado actual).
   */
  gatewayEnabled: false,
}
