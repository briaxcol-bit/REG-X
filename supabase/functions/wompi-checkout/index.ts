// ============================================================
// REG-X — Edge Function: wompi-checkout
// ------------------------------------------------------------
// El dueño (OWNER/ADMIN) inicia el pago de su suscripción.
// - Valida que el usuario pertenece al tenant y su rol.
// - Toma el precio del plan desde la BD (nunca del cliente).
// - Crea una fila PENDING en payment_transactions (service role).
// - Firma la transacción con el SECRETO DE INTEGRIDAD (server-side).
// - Devuelve la URL del Web Checkout de Wompi para redirigir.
//
// Secretos requeridos (supabase secrets set ...):
//   WOMPI_PUBLIC_KEY, WOMPI_INTEGRITY_SECRET
// Inyectados por Supabase automáticamente:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, sha256Hex } from '../_shared/cors.ts'

const CHECKOUT_BASE = 'https://checkout.wompi.co/p/'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader) return json({ error: 'missing_authorization' }, 401)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const PUBLIC_KEY = Deno.env.get('WOMPI_PUBLIC_KEY') ?? ''
    const INTEGRITY_SECRET = Deno.env.get('WOMPI_INTEGRITY_SECRET') ?? ''

    if (!PUBLIC_KEY || !INTEGRITY_SECRET) {
      return json({ error: 'wompi_not_configured' }, 500)
    }

    const { tenantId, planCode, redirectUrl } = await req.json()
    if (!tenantId || !planCode) return json({ error: 'missing_params' }, 400)

    // Cliente con el JWT del usuario (respeta RLS) para validar identidad/rol.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) return json({ error: 'invalid_user' }, 401)
    const user = userData.user

    // El usuario debe ser OWNER/ADMIN del tenant (RLS solo devuelve sus filas).
    const { data: roleRow } = await userClient
      .from('user_tenant_roles')
      .select('role, is_active')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!roleRow || !['OWNER', 'ADMIN'].includes(roleRow.role)) {
      return json({ error: 'forbidden' }, 403)
    }

    // Precio real del plan desde la BD (no confiamos en el cliente).
    const { data: plan, error: planErr } = await userClient
      .from('plans')
      .select('code, price, currency, is_active')
      .eq('code', planCode)
      .maybeSingle()

    if (planErr || !plan || !plan.is_active) return json({ error: 'invalid_plan' }, 400)

    const amountInCents = Math.round(Number(plan.price) * 100)
    const currency = plan.currency ?? 'COP'
    if (!amountInCents || amountInCents <= 0) return json({ error: 'plan_not_payable' }, 400)

    // Referencia única de pago.
    const reference = `REGX-${tenantId}-${Date.now()}`

    // Inserta la transacción PENDING con service role (bypassa RLS).
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)
    const { error: insErr } = await admin.from('payment_transactions').insert({
      tenant_id: tenantId,
      provider: 'WOMPI',
      reference,
      plan_code: planCode,
      amount_in_cents: amountInCents,
      currency,
      status: 'PENDING',
      created_by: user.id,
    })
    if (insErr) return json({ error: 'db_insert_failed', detail: insErr.message }, 500)

    // Firma de integridad: SHA256(reference + amountInCents + currency + integritySecret)
    const signature = await sha256Hex(`${reference}${amountInCents}${currency}${INTEGRITY_SECRET}`)

    // URL del Web Checkout (GET con parámetros).
    const params = new URLSearchParams({
      'public-key': PUBLIC_KEY,
      currency,
      'amount-in-cents': String(amountInCents),
      reference,
      'signature:integrity': signature,
    })
    const finalRedirect = redirectUrl ?? Deno.env.get('WOMPI_REDIRECT_URL') ?? ''
    if (finalRedirect) params.set('redirect-url', finalRedirect)
    if (user.email) params.set('customer-data:email', user.email)

    const checkoutUrl = `${CHECKOUT_BASE}?${params.toString()}`

    return json({ checkoutUrl, reference, amountInCents, currency, publicKey: PUBLIC_KEY })
  } catch (e) {
    return json({ error: 'unexpected', detail: String((e as Error)?.message ?? e) }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
