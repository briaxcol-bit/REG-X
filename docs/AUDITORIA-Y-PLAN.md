# REG-X — Auditoría de estado y plan priorizado

_Fecha: 2026-07-01_

## Resumen ejecutivo

REG-X está vendido como "ERP/POS SaaS Enterprise", pero hoy es, en la práctica, un
**POS multi-tenant funcional con panel de plataforma (superadmin)**. La arquitectura
del backend está bien pensada (monolito modular, ADRs, RLS, observabilidad), pero
**la mayoría de sus módulos son cascarones vacíos** y —lo más importante— **el frontend
no usa el backend: habla directo a Supabase.**

### Hallazgo crítico: hay dos "backends" y solo uno está en uso

- `frontend/src/lib/api.ts` es un cliente axios bien construido que apunta al backend
  NestJS (`/api/v1`, inyecta JWT + `x-tenant-id`). **Está importado en 0 módulos.**
- `frontend/src/lib/supabase.ts` se usa en 7 sitios. Las páginas consultan tablas con
  `.from(...)` directamente contra Supabase.

**Consecuencia:** el backend NestJS (auth, products, pos) es, desde el punto de vista
de la app real, código muerto. Todo el aislamiento entre tenants depende **100% de las
políticas RLS de Supabase.** Si una política RLS está mal, un tenant ve datos de otro y
no hay ninguna capa de backend que lo impida. Por eso la auditoría de RLS es la máxima
prioridad.

---

## Estado real de los módulos

### Backend (NestJS) — `backend/src/modules`

| Módulo | Estado | Evidencia |
|---|---|---|
| products | **Completo** | entity, dtos, use-case, controller, repo Supabase (182 líneas) |
| pos | **Parcial** | solo `create-sale` (use-case 204, entity 158, eventos) — falta cancelar, listar, etc. |
| auth | **Parcial** | service 136, controller 63, estrategia JWT — funcional |
| webhooks | **Parcial** | service 87 + listener |
| subscriptions | **Solo entidad** | entity 111 líneas, pero módulo vacío (sin controller/service, no cableado) |
| api-keys, audit-logs, bar, billing, cash-register, customers, inventory, marketplace, notifications, promotions, reports, restaurant, roles, tenants, users | **Stub vacío** | `@Module({})` de 4 líneas, registrados en `app.module` pero no hacen nada |

**16 de 20 módulos del backend están vacíos.**

### Frontend (React/Vite) — `frontend/src/modules`

| Módulo | Estado | Líneas aprox. |
|---|---|---|
| pos | **Completo** | 3.975 |
| platform (superadmin) | **Completo** | 2.355 |
| products | **Completo** | 1.305 |
| auth | **Completo** | 1.070 |
| inventory | **Completo** | 1.031 |
| employees | **Completo** | 944 |
| customers | **Completo** | 600 |
| restaurant | **Parcial** | 528 |
| reports | **Parcial** | 526 |
| dashboard | **Parcial** | 313 |
| settings | **Parcial** | 247 |
| subscriptions | **Stub** | 48 |
| marketplace | **Stub** | 42 |

El trabajo real vive en el frontend. Módulos como `employees`, `inventory` o `customers`
existen y funcionan en el front **aunque su backend esté vacío**, precisamente porque van
directo a Supabase.

### Calidad y salud del repo

- **0 tests** en todo el proyecto, pese a tener Jest y scripts `test:cov`/`test:e2e`.
- Historial de git con commits ruidosos (`....`, `...`, varios "Resolve merge conflicts").
- Raíz del repo con scripts sueltos: `reset-password.js`, `setup-superadmin.js`,
  `setup-tenant.js`, `regx_setup_completo.sql`, `setup-superadmin-rls.sql`,
  `supabase_rls_products.sql`.
- Basura de desarrollo rastreada en frontend: `parse.js`, `test_col.js`,
  `test_products.js`, `test_tenants.js`.
- README raíz vacío (aunque `docs/` tiene buen material: ADRs, arquitectura).
- Secretos bien manejados: `.env` en `.gitignore`, `.env.example` presente.

---

## Plan priorizado (por riesgo, no por diversión)

### 0. Decisión de alcance _(tú, no código)_
Elige y comunica una de dos: **(A)** relanzarlo honestamente como "POS multi-tenant"
(vendible ya), o **(B)** asumir que el ERP completo está a meses. En cualquier caso,
**los 16 módulos vacíos del backend deben construirse o borrarse** — no dejarlos como
ruido en `main`.

### 1. Auditar y blindar RLS multi-tenant _(máxima prioridad)_
Como el frontend habla directo a Supabase, la seguridad ES RLS. Revisar que **todas**
las tablas con datos de tenant tengan RLS activado y política de aislamiento por
`tenant_id`, y que no existan tablas expuestas sin política. Un fallo aquí es fuga de
datos entre clientes.

### 2. Decidir el papel del backend NestJS
O se conecta el frontend al backend (usar `lib/api.ts`, mover la lógica de negocio y
validación de dinero al servidor) o se acepta el modelo Supabase-directo y se deja de
mantener backend a medias. Mantener dos medios backends es la peor opción.

### 3. Tests donde se mueve dinero
`pos` (cobrar), `products`/`inventory` (descontar stock) y aislamiento de tenant.
No hace falta cobertura alta; hace falta que lo crítico no se rompa en silencio.

### 4. Higiene del repo _(rápido y barato)_
Mover scripts sueltos a `scripts/`, borrar los `test_*.js` de frontend, README de
arranque, y commits con mensajes decentes de aquí en adelante.
Ver `scripts/cleanup-repo.sh`.

---

## Siguiente paso sugerido
Commitea los cambios pendientes del working tree, luego corre `scripts/cleanup-repo.sh`,
y de ahí atacamos la auditoría de RLS (paso 1), que es donde está el riesgo real.
