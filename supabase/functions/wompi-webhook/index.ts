// ============================================================
// REG-X — Edge Function: wompi-webhook
// ------------------------------------------------------------
// Recibe los Eventos de Wompi (transaction.updated).
// - Verifica el checksum del evento con el SECRETO DE EVENTOS.
// - Si la transacción fue APPROVED, llama a wompi_apply_transaction
//   (service role) que activa/renueva la suscripción del tenant.
// - Responde 200 siempre que la firma sea válida (aunque no se apruebe),
//   para que Wompi no reintente indefinidamente.
//
// Configura esta URL como "URL de eventos" en el Dashboard de Wompi:
//   https://<PROJECT_REF>.supabase.co/functions/v1/wompi-webhook
//
// IMPORTANTE: despliega SIN verificación de JWT para que Wompi pueda
// llamarla (supabase functions deploy wompi-webhook --no-verify-jwt).
//
// Secreto requerido: WOMPI_EVENTS_SECRET
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sha256Hex } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 })

  const EVENTS_SECRET = Deno.env.get('WOMPI_EVENTS_SECRET') ?? ''
  if (!EVENTS_SECRET) return new Response('not_configured', { status: 500 })

  let body: any
  const raw = await req.text()
  try {
    body = JSON.parse(raw)
  } catch {
    return new Response('bad_json', { status: 400 })
  }

  // ── Verificación de firma ────────────────────────────────
  const properties: string[] = body?.signature?.properties ?? []
  const provided: string = String(body?.signature?.checksum ?? '')
  const timestamp = body?.timestamp
  if (!properties.length || !provided || timestamp === undefined) {
    return new Response('missing_signature', { status: 400 })
  }

  let concat = ''
  for (const path of properties) {
    concat += String(getByPath(body.data, path) ?? '')
  }
  concat += String(timestamp)
  concat += EVENTS_SECRET

  const expected = (await sha256Hex(concat)).toLowerCase()
  if (expected !== provided.toLowerCase()) {
    return new Response('invalid_signature', { status: 401 })
  }

  // ── Aplicar el resultado ─────────────────────────────────
  if (body.event === 'transaction.updated' && body?.data?.transaction) {
    const tx = body.data.transaction
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    const { error } = await admin.rpc('wompi_apply_transaction', {
      p_reference: tx.reference,
      p_status: tx.status,
      p_wompi_id: tx.id ?? null,
      p_amount: tx.amount_in_cents ?? null,
    })
    if (error) {
      // Devolvemos 500 para que Wompi reintente si algo falló de nuestro lado.
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

/** Resuelve una ruta tipo "transaction.id" dentro de un objeto. */
function getByPath(obj: any, path: string): unknown {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj)
}
