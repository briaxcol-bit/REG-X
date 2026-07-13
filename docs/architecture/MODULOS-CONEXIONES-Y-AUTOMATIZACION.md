# REG-X — Análisis de Módulos, Conexiones y Automatización

> Generado: 2026-07-12. Basado en revisión de `frontend/src/modules`, `frontend/src/lib/db.ts`,
> `backend/src/modules` y `database/migrations/001–038`.

---

## 1. Diagnóstico general

**Lo bueno:** el catálogo de módulos (migración 013) está bien diseñado, la venta es atómica
vía RPC (`create_sale_transaction`, migración 021), hay RLS consistente y auditoría por
triggers (038).

**El problema central:** los módulos son **islas**. Cada uno tiene sus tablas y su página,
pero casi nada fluye automáticamente entre ellos. Todo lo que debería ser consecuencia de
una venta, una compra o un turno hoy requiere digitación manual duplicada.

**Hallazgos estructurales:**

1. **El backend NestJS está muerto en la práctica.** `frontend/src/lib/api.ts` existe pero
   **cero archivos lo importan**. El 100% del frontend habla directo con Supabase vía
   `lib/db.ts` (4.781 líneas, 226 funciones). Decidir: o se elimina el backend y se declara
   Supabase-first (RPCs + edge functions como capa de lógica), o se migra la lógica crítica
   al backend. Mantener ambos a medias es deuda pura. **Recomendación: Supabase-first** —
   ya es la realidad; la lógica de negocio vive en RPCs de Postgres (patrón 021) y edge
   functions (patrón Wompi).
2. **`db.ts` es un monolito.** 226 funciones en un archivo. Dividir en `lib/db/` por dominio
   (`sales.ts`, `finance.ts`, `inventory.ts`, …) con un barrel export. Cero riesgo, alto retorno.
3. **POS ignora a promotions, price_lists, loyalty y gift_cards.** Grep en `modules/pos`:
   ninguna referencia. Son módulos vendidos que no afectan el cobro.

---

## 2. Módulos que SÍ o SÍ deben ser core

Hoy el core (013) es: `pos, inventory, customers, reports, expenses, suppliers, cash_register`.

**Propuesta de core revisado — el criterio es: "sin esto, los números del negocio no cuadran":**

| Módulo | Estado actual | Veredicto |
|---|---|---|
| `pos` | core | ✅ core (es el corazón) |
| `inventory` | core | ✅ core |
| `cash_register` | core | ✅ core |
| `customers` | core | ✅ core |
| `expenses` | core | ✅ core |
| `suppliers` | core | ✅ core |
| `reports` | core | ✅ core |
| `employees` | hr / FREE | ⬆️ **subir a core** — sales.created_by, cajas por usuario y auditoría dependen de empleados; todo negocio con >1 persona lo necesita |
| `accounts_receivable` | finance / BASIC | ⬆️ **subir a core** — fiar/crédito es universal en el mercado objetivo (Colombia); además layaway y ventas a crédito lo necesitan como destino automático |
| `accounts_payable` | finance / BASIC | ⬆️ **subir a core** — es la contraparte natural de expenses y purchase_orders; sin él, "cuánto debo" no existe |
| `audit_log` | advanced / PRO | ⬆️ **core técnico** — los triggers 038 ya escriben siempre; cobrar solo la *pantalla* está bien, pero el registro debe ser universal (ya lo es) |

`accounting` (libro diario) se queda en PROFESSIONAL, pero deja de ser una isla: se alimenta
solo (ver §4). `purchase_orders` se queda en BASIC pero se vuelve la fuente automática de
inventario y payables.

---

## 3. Mapa de conexiones que faltan (hoy: 0 automáticas)

```
                       ┌──────────────── VENTA (create_sale_transaction) ────────────────┐
                       │ hoy: stock ↓ + pagos + caja   (lo único automático que existe)  │
                       └──────────────────────────────────────────────────────────────────┘
   FALTA que la venta dispare:
   ├─► loyalty_transactions   (acumular puntos si loyalty activo)      [hoy 100% manual]
   ├─► receivables            (si método de pago = CREDIT/FIADO)       [hoy no existe CREDIT]
   ├─► gift_cards             (redención como método de pago)          [hoy desconectado]
   ├─► promotions/price_lists (aplicar precio correcto ANTES de cobrar)[hoy ignorados]
   ├─► commission_accruals    (devengar comisión del vendedor)         [hoy solo reporte]
   └─► journal_entries        (asiento ventas/IVA si accounting activo)[hoy manual]

   COMPRA (purchase_orders.status → RECEIVED)
   ├─► inventory: entrada de stock por ítem                            [hoy NO pasa nada]
   ├─► payables: crear cuenta por pagar al proveedor                   [hoy NO pasa nada]
   └─► batches: crear lote si batch_tracking activo                    [hoy manual]

   GASTO (expenses)
   ├─► payables: si is_paid=false → cuenta por pagar                   [hoy desconectado]
   └─► journal_entries: asiento de gasto                               [hoy manual]

   NÓMINA (payroll_entries) — hoy se digita TODO a mano
   ├─◄ attendance: horas trabajadas del período                        [existe la data]
   ├─◄ commissions: reporte del período                                [existe la data]
   ├─◄ tips: propinas asignadas                                        [existe la data]
   └─► expenses/journal: al marcar PAID, registrar el gasto            [hoy no]

   CIERRE DE CAJA (cash_registers.close)
   └─► journal_entries: asiento de cierre + descuadre                  [hoy no]

   LAYAWAY / APARTADOS
   └─► al completar abonos → generar venta real (con stock)            [hoy islas]

   QUOTES / WORK ORDERS
   └─► estado ACCEPTED/DONE → convertir a venta                        [existe enum CONVERTED, no hay flujo]
```

---

## 4. Plan de implementación (todo con el patrón que ya funciona: RPCs + triggers)

### Fase 1 — El dinero cuadra (mayor impacto, ~1 migración grande)
**Migración 039_sale_side_effects.sql**, extendiendo `create_sale_transaction`:
1. **Método de pago `CREDIT`**: si un pago es CREDIT y hay `customer_id`, insertar en
   `receivables` (monto, referencia = order_number). El POS gana el botón "Fiado".
2. **Loyalty automático**: si `loyalty_config.is_active`, calcular puntos
   (`total / currency_per_point`), insertar `loyalty_transactions` y actualizar
   `customers.loyalty_points`. Dentro de la misma transacción.
3. **Gift card como pago**: método `GIFT_CARD` con `reference = código`; el RPC valida
   saldo, descuenta y registra `gift_card_transactions`.

### Fase 2 — Compras alimentan inventario y deuda
**Migración 040_po_receive.sql** — RPC `receive_purchase_order(po_id)`:
- Transacción única: entrada de stock por cada ítem (+ `stock_movements` tipo PURCHASE),
  creación de `payables` (supplier, total, vencimiento según términos del proveedor),
  creación de `batches` si el módulo está activo, y `status = RECEIVED`.
- El frontend cambia `updatePurchaseOrderStatus(...,'RECEIVED')` por este RPC.

### Fase 3 — Contabilidad se alimenta sola
**Migración 041_auto_journal.sql** — función `post_journal(source_type, source_id, lines)` +
llamadas desde los RPCs de venta, gasto, recepción de PO, cierre de caja y pago de nómina.
- Solo si el tenant tiene `accounting` activo (consultar `tenant_modules`).
- Plan de cuentas semilla mínimo (caja, bancos, inventario, ventas, IVA, CxC, CxP, gastos,
  nómina) creado al activar el módulo.
- Con esto `getTrialBalance` y `getTaxSummary` pasan de "lo que digitaste" a "lo que pasó".

### Fase 4 — Nómina deja de digitarse
**RPC `generate_payroll_draft(period_from, period_to)`**:
- Por empleado: base del perfil + horas de `attendance` + comisiones de
  `getCommissionReport` (portar la lógica a SQL) + propinas de `tips`.
- Devuelve borrador editable; al `markPayrollPaid` → gasto en `expenses`
  (categoría NÓMINA) + asiento si accounting activo.

### Fase 5 — Cerrar los ciclos de documentos
- `convert_quote_to_sale(quote_id)` → crea la venta con los ítems (enum CONVERTED ya existe).
- `complete_layaway(layaway_id)` → cuando `paid >= total`, genera venta real vía el RPC de venta.
- `work_orders` DONE → opción de facturar (misma conversión).
- POS aplica `promotions` y `price_lists` al armar el carrito (esto es frontend:
  un `usePricing(customer, items)` que consulta ambas tablas — hoy ni se leen).

### Fase 6 — Higiene arquitectónica
- Partir `db.ts` en `lib/db/<dominio>.ts`.
- Decidir formalmente el destino del backend NestJS (ADR en `docs/adr/`): recomendado
  archivarlo o reducirlo a webhooks/integraciones que no pueden vivir en edge functions.
- Emitir eventos a `webhook_endpoints` desde los RPCs clave (venta, PO, pago) — el módulo
  webhooks hoy solo guarda URLs, nunca dispara.

---

## 5. Reglas de diseño para no volver a las islas

1. **Toda consecuencia de dinero o stock va DENTRO de la transacción que la causa** (patrón 021).
   Nada de "el frontend luego llama otra función" — eso se olvida y descuadra.
2. **Los side-effects se activan por `tenant_modules`**: el RPC consulta si el módulo está
   activo y actúa en consecuencia. Un solo código, comportamiento por plan.
3. **Ningún módulo nuevo entra sin declarar sus flechas**: qué consume, qué produce, y en
   qué RPC se engancha.
4. **El frontend nunca hace dos writes que deban ser consistentes entre sí.** Si necesita
   dos, es un RPC.

---

## 6. ESTADO DE IMPLEMENTACIÓN (2026-07-12)

Todo el plan de §4 quedó implementado en esta iteración:

| Fase | Entregable | Estado |
|---|---|---|
| F1 | `039_sale_side_effects.sql` — pago CREDIT→CxC, GIFT_CARD con validación de saldo, loyalty automático | ✅ |
| F2 | `040_po_receive.sql` — RPC `receive_purchase_order`: stock + movimientos + CxP + lotes + costo del producto | ✅ |
| F3 | `041_auto_journal.sql` — `post_journal` + plan de cuentas semilla + triggers (venta, gasto, abonos CxC/CxP, CxP nueva, cierre de caja, gift card, nómina pagada→gasto) | ✅ |
| F4 | `042_payroll_generate.sql` — `base_salary` en roles + `generate_payroll_draft` (asistencia + comisiones + propinas) | ✅ |
| F5 | `043_document_conversions.sql` — `convert_quote_to_sale`, `complete_layaway`, `invoice_work_order` + outbox de webhooks (sale.completed, purchase_order.received) | ✅ |
| F5b | `044_customer_price_list.sql` — vínculo cliente→lista de precios | ✅ |
| F6 | Frontend: POS con Fiado y Gift Card, promos/listas aplicadas al carrito (`usePosPricing`), recibir PO real, nómina automática, convertir cotización, facturar orden de trabajo, entregar apartado | ✅ |
| F6b | `ADR-004-supabase-first.md` — backend NestJS archivado formalmente | ✅ |

### Detalles de diseño que importan

- **Los side-effects contables jamás rompen la operación origen**: todos los
  triggers de asientos envuelven su lógica en `EXCEPTION WHEN OTHERS → WARNING`.
- **Activación por módulo**: cada automatización consulta `tenant_module_active()`
  — mismo código, comportamiento según el plan del tenant.
- **Idempotencia**: `post_journal` no duplica asientos (dedupe por referencia);
  `generate_payroll_draft` no duplica períodos; el outbox no duplica entregas.
- **Asientos de venta diferidos a COMMIT** (constraint triggers) para ver los
  pagos insertados en la misma transacción.
- Ítems de servicio sin producto (mano de obra) usan el producto `SVC-GEN`
  auto-creado, sin inventario.

### Pendientes conscientes (no bloqueantes)

1. **Dispatcher de webhooks**: el outbox (`webhook_deliveries` con payload) ya
   se llena; falta la edge function que haga los POST firmados (cron cada minuto).
2. **Split de `db.ts`** en `lib/db/<dominio>.ts` — refactor mecánico grande,
   hacerlo en una sesión dedicada con typecheck continuo.
3. Promos **BOGO/COMBO** no se auto-aplican en el POS (requieren interacción);
   PERCENT/FIXED sí.
4. UI para asignar `base_salary` (existe `setEmployeeBaseSalary` en db.ts;
   falta el campo en la página de Empleados).
5. UI para asignar lista de precios a un cliente (existe `setCustomerPriceList`).
