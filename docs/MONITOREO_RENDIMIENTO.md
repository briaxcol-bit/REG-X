# Monitoreo de rendimiento — rutina mensual

Proyecto Supabase de la app: **ofsgenbpqfrcyvtiannb** (no confundir con "SGIO").

## Dónde mirar (5 minutos)

1. **Dashboard → Reports → Database**: CPU, RAM, conexiones. Picos sostenidos de
   CPU suelen ser queries sin índice o RLS por fila (ya corregido en 058/059 —
   si reaparece, algo nuevo lo reintrodujo).
2. **Dashboard → Advisors → Performance**: Supabase lista solo índices
   faltantes y políticas RLS lentas. Revisar después de cada migración nueva.
3. **Dashboard → Database → Query Performance**: top de queries por tiempo
   total. Ordenar por `total_time`, no por `mean_time` (una query de 5 ms que
   corre 100.000 veces pesa más que una de 2 s que corre una vez).

## Queries útiles (SQL Editor)

Top 15 por tiempo total consumido:

```sql
SELECT
  round(total_exec_time::numeric, 0) AS total_ms,
  calls,
  round(mean_exec_time::numeric, 1)  AS avg_ms,
  left(query, 120)                   AS query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 15;
```

Reiniciar el contador (hacerlo tras cada revisión para comparar meses):

```sql
SELECT pg_stat_statements_reset();
```

Índices que nunca se usan (candidatos a eliminar si llevan meses en cero):

```sql
SELECT schemaname, relname AS tabla, indexrelname AS indice, idx_scan AS usos
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

Tablas con más lecturas secuenciales (posible índice faltante):

```sql
SELECT relname AS tabla, seq_scan, idx_scan,
       n_live_tup AS filas
FROM pg_stat_user_tables
WHERE schemaname = 'public' AND seq_scan > idx_scan AND n_live_tup > 1000
ORDER BY seq_scan DESC
LIMIT 10;
```

Verificar que RLS sigue en modo InitPlan (post-058/059) — el plan NO debe
mostrar `user_belongs_to_tenant` en el `Filter` por fila:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM products WHERE tenant_id = '<un-tenant-real>';
```

## Señales de alarma

- `avg_ms` > 100 en una query que corre desde el POS → revisar índice/plan.
- Crecimiento sostenido de `calls` en una query pesada → algún polling nuevo
  del frontend quedó sin control (buscar `refetchInterval` agregados).
- El Advisor de Supabase reporta "auth_rls_initplan" → alguna política nueva
  se creó con el patrón viejo; re-ejecutar 058 y 059 (son idempotentes).

## Reglas para código nuevo

- Toda tabla nueva con `tenant_id`: crear índice `(tenant_id, ...)` en la misma
  migración, y escribir la política RLS con
  `tenant_id IN (SELECT unnest(get_user_tenant_ids()))` — nunca llamar
  `user_belongs_to_tenant(tenant_id)` a secas (se ejecuta por fila).
- Listados que crecen con el tiempo: siempre `.limit(...)`.
- Pollings (`refetchInterval`): preguntarse si Realtime o un fingerprint
  liviano (ver `getSalesFingerprint` en `lib/db/pos.ts`) puede evitarlos.
- Agregaciones (sumas/conteos para KPIs): hacerlas en RPC, no descargando
  filas (ver `get_dashboard_stats` y `get_sales_report_stats`).
