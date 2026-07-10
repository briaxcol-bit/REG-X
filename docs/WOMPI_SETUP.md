# Integración de pagos con Wompi (Checkout por período)

Cobro de la suscripción del SaaS con Wompi: el dueño da clic en **Pagar en línea**,
paga con tarjeta / PSE / Nequi / Bancolombia y, al aprobarse, su suscripción se
**activa/renueva 1 mes automáticamente** (vía webhook). El pago manual sigue
disponible como alternativa.

## Piezas

| Pieza | Archivo | Qué hace |
|---|---|---|
| Tabla + RPC | `database/migrations/025_wompi_payments.sql` | Guarda cada transacción y activa la suscripción al aprobarse (idempotente) |
| Edge Function checkout | `supabase/functions/wompi-checkout/` | Firma la transacción (server-side) y devuelve la URL de pago |
| Edge Function webhook | `supabase/functions/wompi-webhook/` | Verifica el evento de Wompi y aplica el resultado |
| Config frontend | `frontend/src/config/billing.ts` | Llave pública + flag de activación |
| Botón de pago | `frontend/src/modules/subscriptions/pages/SubscriptionsPage.tsx` | "Pagar en línea con Wompi" + verificación al volver |

> El frontend pega directo a Supabase (no hay backend propio en uso), por eso la
> firma y el webhook viven en **Edge Functions**. La llave pública es la única que
> vive en el frontend; las secretas van en los secretos de las funciones.

## Paso a paso

### 1. Crear la cuenta y obtener llaves
Regístrate en el **Dashboard de Comercios de Wompi** y en *Desarrolladores → Secretos
para integración técnica* copia:
- **Llave pública** (`pub_test_...` sandbox / `pub_prod_...` producción)
- **Secreto de integridad** (`test_integrity_...` / `prod_integrity_...`)
- **Secreto de eventos** (`test_events_...` / `prod_events_...`)

Hay un juego de llaves para **Sandbox** y otro para **Producción**. Empieza en Sandbox.

### 2. Aplicar la migración
En el SQL Editor de Supabase (proyecto **ofsgenbpqfrcyvtiannb**, NO "SGIO") corre
`025_wompi_payments.sql`.

### 3. Desplegar las Edge Functions
Con el [CLI de Supabase](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref ofsgenbpqfrcyvtiannb

# Secretos (NO se suben al repo)
supabase secrets set WOMPI_PUBLIC_KEY="pub_test_xxx"
supabase secrets set WOMPI_INTEGRITY_SECRET="test_integrity_xxx"
supabase secrets set WOMPI_EVENTS_SECRET="test_events_xxx"
# Opcional: URL fija de retorno (si no, la manda el frontend)
supabase secrets set WOMPI_REDIRECT_URL="https://tuapp.com/subscriptions"

# Deploy
supabase functions deploy wompi-checkout
supabase functions deploy wompi-webhook --no-verify-jwt   # Wompi debe poder llamarla sin JWT
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta
Supabase automáticamente en las funciones; no hay que configurarlos.

### 4. Configurar la URL de eventos en Wompi
En el Dashboard de Wompi → *Desarrolladores → URL de eventos*, para el ambiente
correspondiente, pon:

```
https://ofsgenbpqfrcyvtiannb.supabase.co/functions/v1/wompi-webhook
```

(Sandbox y Producción usan URLs de eventos separadas.)

### 5. Configurar el frontend
En el `.env` del frontend:

```
VITE_WOMPI_PUBLIC_KEY=pub_test_xxx
VITE_WOMPI_ENV=sandbox
```

Con `VITE_WOMPI_PUBLIC_KEY` presente, el botón "Pagar en línea con Wompi" aparece solo.
Si lo dejas vacío, la UI cae al **cobro manual** automáticamente.

### 6. Probar en Sandbox
Usa las tarjetas y datos de prueba de Wompi
(https://docs.wompi.co/docs/colombia/datos-de-prueba-en-sandbox/). Flujo esperado:
1. Botón → redirige al Checkout de Wompi.
2. Pagas (aprobado) → Wompi redirige de vuelta a `/subscriptions?id=...`.
3. La página muestra "Confirmando tu pago…" y refresca.
4. El webhook recibe el evento, valida el checksum y activa la suscripción.

## Notas de seguridad
- La **firma de integridad** y la **verificación del checksum** se hacen **solo en el
  servidor** (Edge Functions). Nunca pongas los secretos en el frontend.
- El monto se toma de la tabla `plans` en el servidor, no del cliente.
- `wompi_apply_transaction` es **idempotente**: si Wompi reintenta el evento, no
  vuelve a extender la suscripción.
- No valides el pago con la redirección (`?id=`), solo úsala como aviso al usuario;
  la activación real la hace el **webhook**.

## Pasar a producción
Repite con las llaves `pub_prod_` / `prod_integrity_` / `prod_events_`, cambia
`VITE_WOMPI_ENV=production` y configura la URL de eventos del ambiente de Producción.

## Siguiente fase (opcional): débito recurrente automático
Este flujo cobra **por período** (el cliente inicia cada pago). Para cobro
automático mensual sin intervención se usa la tokenización de fuentes de pago de
Wompi (`payment_sources`) + un job programado; la tabla `payment_transactions` y el
webhook ya quedan listos para extenderse a ese modelo.
