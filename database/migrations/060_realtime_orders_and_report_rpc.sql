-- ═════════════════════════════════════════════════════════════
-- 060 · Realtime para mesas + reporte de ventas agregado en servidor
--
-- 1) El POS ya se suscribe a cambios de orders/order_items por Realtime,
--    pero esas tablas deben estar en la publicación supabase_realtime
--    para que los eventos lleguen. Con esto, las mesas se actualizan al
--    instante y el polling del frontend pasa a ser solo respaldo (30s).
--
-- 2) get_sales_report_stats: la página de Reportes bajaba hasta 2.000
--    ventas con ítems y pagos para sumar en el navegador (y con >2.000
--    ventas en el período los totales salían incompletos). Este RPC
--    agrega TODO en el servidor: exacto y en una sola llamada.
--
-- Idempotente. SECURITY INVOKER: respeta RLS del usuario.
-- Ejecutar en el proyecto Supabase de la app (ofsgenbpqfrcyvtiannb),
-- después de la 058 y la 059.
-- ═════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1) Publicación Realtime (los eventos respetan RLS del suscriptor)
--    Se verifica la membresía ANTES de agregar: si la tabla ya está
--    en la publicación (p. ej. Realtime activado desde el dashboard),
--    simplemente se omite — nunca lanza error.
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['orders', 'order_items'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'Realtime activado para %', t;
    ELSE
      RAISE NOTICE 'Realtime ya estaba activo para % — omitido', t;
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 2) RPC: estadísticas del reporte de ventas
--    Los límites de fecha vienen del cliente (mismos que usaba el filtro
--    en JS). El gráfico diario agrupa por fecha UTC, igual que hacía el
--    frontend (created_at.split('T')[0]).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_sales_report_stats(
  p_tenant_id  uuid,
  p_branch_id  uuid,
  p_since      timestamptz,
  p_until      timestamptz,
  p_prev_since timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH cur AS (
    SELECT id, total, tax_total, created_at
    FROM sales
    WHERE tenant_id = p_tenant_id AND branch_id = p_branch_id
      AND status = 'COMPLETED'
      AND created_at >= p_since AND created_at <= p_until
  ),
  prev AS (
    SELECT id, total, created_at
    FROM sales
    WHERE tenant_id = p_tenant_id AND branch_id = p_branch_id
      AND status = 'COMPLETED'
      AND created_at >= p_prev_since AND created_at < p_since
  )
  SELECT jsonb_build_object(
    'current', (
      SELECT jsonb_build_object(
        'total',     coalesce(sum(total), 0),
        'count',     count(*),
        'tax_total', coalesce(sum(tax_total), 0)
      ) FROM cur
    ),
    'previous', (
      SELECT jsonb_build_object(
        'total', coalesce(sum(total), 0),
        'count', count(*)
      ) FROM prev
    ),
    'daily_current', (
      SELECT coalesce(jsonb_agg(d ORDER BY d.day), '[]'::jsonb)
      FROM (
        SELECT to_char((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day,
               sum(total) AS total
        FROM cur
        GROUP BY 1
      ) d
    ),
    'daily_prev_offsets', (
      SELECT coalesce(jsonb_agg(d ORDER BY d."offset"), '[]'::jsonb)
      FROM (
        SELECT floor(extract(epoch FROM (created_at - p_prev_since)) / 86400)::int AS "offset",
               sum(total) AS total
        FROM prev
        GROUP BY 1
      ) d
    ),
    'by_method', (
      SELECT coalesce(jsonb_agg(m ORDER BY m.amount DESC), '[]'::jsonb)
      FROM (
        SELECT sp.method::text AS method, sum(sp.amount) AS amount
        FROM sale_payments sp
        JOIN cur ON cur.id = sp.sale_id
        GROUP BY 1
      ) m
    ),
    'top_products', (
      SELECT coalesce(jsonb_agg(t), '[]'::jsonb)
      FROM (
        SELECT si.name, sum(si.total) AS revenue, sum(si.quantity) AS qty
        FROM sale_items si
        JOIN cur ON cur.id = si.sale_id
        GROUP BY si.name
        ORDER BY sum(si.total) DESC
        LIMIT 8
      ) t
    )
  )
$$;

GRANT EXECUTE ON FUNCTION public.get_sales_report_stats(uuid, uuid, timestamptz, timestamptz, timestamptz) TO authenticated;
