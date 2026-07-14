-- ============================================================
-- REG-X — Migration 049: Una sola suscripción viva por tenant
-- ------------------------------------------------------------
-- Problema: subscriptions no tenía unicidad por tenant. Flujos
-- antiguos insertaban una fila nueva por activación/renovación y
-- las anteriores quedaban 'ACTIVE' para siempre → el panel de
-- plataforma mostraba 11 suscripciones activas con 3 tenants y
-- el MRR estaba inflado.
--
-- 1. Data fix: por cada tenant se conserva la suscripción MÁS
--    RECIENTE tal cual; todas las anteriores pasan a CANCELLED
--    (se conservan como historial, no se borran).
-- 2. Índice único parcial: solo puede existir UNA suscripción
--    no-cancelada/no-expirada por tenant. Los RPCs existentes
--    (activate_subscription, wompi_apply_transaction) ya hacen
--    upsert sobre la más reciente, así que no chocan con esto.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- 1) Cancelar duplicados históricos (todas menos la más reciente)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at DESC) AS rn
    FROM public.subscriptions
)
UPDATE public.subscriptions s
   SET status        = 'CANCELLED',
       cancelled_at  = COALESCE(s.cancelled_at, now()),
       cancel_reason = COALESCE(s.cancel_reason, 'Duplicado histórico (migración 049)'),
       updated_at    = now()
  FROM ranked r
 WHERE s.id = r.id
   AND r.rn > 1
   AND s.status NOT IN ('CANCELLED', 'EXPIRED');

-- 2) Solo una suscripción viva por tenant
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_one_live_per_tenant
  ON public.subscriptions (tenant_id)
  WHERE status NOT IN ('CANCELLED', 'EXPIRED');

SELECT 'Migración 049 aplicada: una suscripción viva por tenant ✅' AS resultado;
