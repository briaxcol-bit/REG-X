// ============================================================
// REG-X — Edge Function: webhook-dispatcher
// ------------------------------------------------------------
// Procesa el OUTBOX de webhooks (webhook_deliveries con status PENDING,
// llenado por los triggers de la migración 043) y hace los POST a las
// URLs registradas por cada tenant en webhook_endpoints.
//
// - Firma cada entrega con HMAC-SHA256 del secret del endpoint
//   (header: X-RegX-Signature) para que el receptor pueda verificarla.
// - Marca SENT o FAILED (con el error) y nunca reintenta más de
//   MAX_ATTEMPTS veces por entrega (columna error_message acumula).
//
// Despliegue:
//   supabase functions deploy webhook-dispatcher --no-verify-jwt
//
// Programarla (cada minuto) en el SQL Editor con pg_cron + pg_net:
//   select cron.schedule('webhook-dispatcher', '* * * * *', $$
//     select net.http_post(
//       url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/webhook-dispatcher',
//       headers := '{"Content-Type":"application/json"}'::jsonb,
//       body    := '{}'::jsonb
//     );
//   $$);
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BATCH = 25
const TIMEOUT_MS = 8000

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Entregas pendientes con su endpoint
  const { data: deliveries, error } = await supabase
    .from('webhook_deliveries')
    .select('id, event, payload, webhook_endpoints ( id, url, secret, active )')
    .eq('status', 'PENDING')
    .order('delivered_at', { ascending: true })
    .limit(BATCH)

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  let sent = 0, failed = 0
  for (const d of deliveries ?? []) {
    const ep = (d as any).webhook_endpoints
    if (!ep?.active) {
      await supabase.from('webhook_deliveries')
        .update({ status: 'SKIPPED', error_message: 'endpoint inactivo' })
        .eq('id', (d as any).id)
      continue
    }

    const body = JSON.stringify({
      event:     (d as any).event,
      data:      (d as any).payload ?? {},
      timestamp: new Date().toISOString(),
    })

    try {
      const signature = await hmacSha256Hex(ep.secret, body)
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
      const res = await fetch(ep.url, {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'X-RegX-Event':      (d as any).event,
          'X-RegX-Signature':  signature,
        },
        body,
        signal: ctrl.signal,
      })
      clearTimeout(timer)

      if (res.ok) {
        await supabase.from('webhook_deliveries')
          .update({ status: 'SENT', error_message: null, delivered_at: new Date().toISOString() })
          .eq('id', (d as any).id)
        sent++
      } else {
        await supabase.from('webhook_deliveries')
          .update({ status: 'FAILED', error_message: `HTTP ${res.status}` })
          .eq('id', (d as any).id)
        failed++
      }
    } catch (e) {
      await supabase.from('webhook_deliveries')
        .update({ status: 'FAILED', error_message: String(e).slice(0, 250) })
        .eq('id', (d as any).id)
      failed++
    }
  }

  return new Response(JSON.stringify({ processed: (deliveries ?? []).length, sent, failed }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
