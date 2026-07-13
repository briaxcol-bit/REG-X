# ADR-004: Arquitectura Supabase-first (el backend NestJS queda archivado)

**Fecha:** 2026-07-12 · **Estado:** Aceptada

## Contexto

El repo tiene un backend NestJS completo (`backend/src`, ~20 módulos, event bus,
DDD) y un frontend React que habla con Supabase. Auditoría del 2026-07-12:
**cero archivos del frontend importan `lib/api.ts`** (el cliente axios del
backend). El 100% de las operaciones pasa por `lib/db.ts` → Supabase
(PostgREST + RPCs) y edge functions (Wompi). El backend no recibe tráfico.

## Decisión

REG-X es **Supabase-first**:

1. **La lógica de negocio transaccional vive en Postgres** como RPCs
   `SECURITY DEFINER` (patrón `create_sale_transaction`, migración 021) y
   triggers (migraciones 039–044). Regla: si el frontend necesita dos writes
   consistentes entre sí, es un RPC.
2. **Las integraciones externas viven en edge functions** (patrón
   wompi-checkout / wompi-webhook). Ahí va también el dispatcher de webhooks
   salientes (outbox en `webhook_deliveries`).
3. **El backend NestJS queda archivado**: no se le agregan features. Se
   conserva en el repo como referencia hasta que exista una necesidad real
   que Postgres + edge functions no cubran (colas pesadas, workers de larga
   duración, integraciones con estado). Si eso llega, se revive un servicio
   pequeño y enfocado, no el monolito completo.

## Consecuencias

- Una sola fuente de verdad para reglas de dinero/stock (la base de datos);
  imposible saltárselas desde el cliente.
- RLS + RPCs = la seguridad se audita en un solo lugar (migraciones).
- `lib/db.ts` (4.900 líneas) se convierte en el "SDK" del sistema; pendiente
  dividirlo en `lib/db/<dominio>.ts` con barrel export (refactor mecánico).
- Menos infraestructura que operar (no hay servicio Node que desplegar/escalar).
