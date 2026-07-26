# Migraciones — orden canónico de ejecución

Proyecto Supabase de la app: **ofsgenbpqfrcyvtiannb** (⚠️ NO ejecutar nada en
el proyecto "SGIO"). Todas se corren en el SQL Editor, en orden numérico.

## Reglas

1. Ejecutar en orden numérico ascendente. Ante números duplicados, seguir el
   orden de la tabla de abajo.
2. Las migraciones marcadas ★ son idempotentes (se pueden re-ejecutar).
3. Toda migración nueva: tomar el siguiente número libre (062+), sin letras ni
   duplicados, y actualizar este README.
4. Tablas nuevas con `tenant_id`: índice `(tenant_id, ...)` y política RLS con
   el patrón InitPlan (ver 058/059) en la misma migración.

## Números duplicados (orden correcto entre ellos)

| Ejecutar 1º | Ejecutar 2º | Nota |
|---|---|---|
| `011_add_employee.sql` | `011_modules_by_business_type.sql` | independientes |
| `012_employee_cedula_phone.sql` | `012_backfill_and_cascade.sql` | 012_backfill depende del catálogo de 011_modules |
| `013_customer_billing.sql` | `013_full_modules_catalog.sql` | independientes |
| `040_po_receive.sql` | `040_sale_skip_stock_check.sql` | independientes |
| `041_email_in_profiles.sql` | `041_auto_journal.sql` | independientes |
| `048_modules_by_business_type.sql` | — | reemplaza/actualiza lo sembrado en 011/013 |

## Archivos fuera de la numeración

- `MIGRATION_restaurant_orders.sql` — denormaliza `order_items` (name, sku,
  unit_price) y agrega `waiter_id`/`waiter_name` a `orders`. Ejecutar después
  de la 031. El frontend funciona con o sin ella (tiene fallback).
- `FIX_employee_rpcs.sql` — limpieza de RPCs de empleados duplicados.
  Ejecutar después de la 011_add_employee si hay errores de "function is not
  unique" al crear empleados.

## Migraciones de rendimiento/seguridad recientes (orden estricto)

| # | Archivo | Qué hace |
|---|---|---|
| 058 ★ | `058_performance_rls_indexes.sql` | RLS → InitPlan (tenant), índices calientes, RPC `get_dashboard_stats` |
| 059 ★ | `059_role_policies_initplan.sql` | RLS de roles → InitPlan (`get_user_role_tenant_ids`). Requiere 058 |
| 060 ★ | `060_realtime_orders_and_report_rpc.sql` | Realtime para `orders`/`order_items` + RPC `get_sales_report_stats` |
| 061 | `061_validate_sale_totals.sql` | `create_sale_transaction` v5: el servidor valida totales, cantidades y pagos |

Tras aplicar migraciones que crean/cambian RPCs, regenerar los tipos del
frontend:

```bash
npx supabase gen types typescript --project-id ofsgenbpqfrcyvtiannb --schema public > frontend/src/types/database.types.ts
```
