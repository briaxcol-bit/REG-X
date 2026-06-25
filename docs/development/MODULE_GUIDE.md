# Guía: Cómo agregar un nuevo módulo DDD

Esta guía muestra paso a paso cómo agregar un módulo completo al sistema REG-X siguiendo DDD + Arquitectura Hexagonal.

## Ejemplo: Agregar módulo "Loyalty" (Fidelización)

### 1. Crear estructura de carpetas

```
src/modules/loyalty/
├── domain/
│   ├── entities/
│   │   └── loyalty-account.entity.ts
│   ├── value-objects/
│   │   └── points-balance.vo.ts
│   ├── events/
│   │   ├── points-earned.event.ts
│   │   └── points-redeemed.event.ts
│   ├── repositories/
│   │   └── loyalty-account.repository.ts   ← Port (interface)
│   └── services/
│       └── points-calculator.service.ts
├── application/
│   ├── use-cases/
│   │   ├── earn-points.use-case.ts
│   │   └── redeem-points.use-case.ts
│   └── dtos/
│       ├── earn-points.dto.ts
│       └── redeem-points.dto.ts
├── infrastructure/
│   ├── repositories/
│   │   └── supabase-loyalty.repository.ts  ← Adapter
│   └── controllers/
│       └── loyalty.controller.ts
└── loyalty.module.ts
```

### 2. Definir la entidad raíz del agregado

```typescript
// domain/entities/loyalty-account.entity.ts
export class LoyaltyAccount extends AggregateRoot {
  static create(params: { tenantId: string; customerId: string }): LoyaltyAccount { ... }
  earnPoints(amount: number, reason: string): void { ... }
  redeemPoints(points: number): void { ... }
}
```

### 3. Definir el Port (interfaz del repositorio)

```typescript
// domain/repositories/loyalty-account.repository.ts
export interface ILoyaltyRepository {
  findByCustomerId(customerId: string, tenantId: string): Promise<LoyaltyAccount | null>
  save(account: LoyaltyAccount): Promise<void>
  update(account: LoyaltyAccount): Promise<void>
}
export const LOYALTY_REPOSITORY = Symbol('ILoyaltyRepository')
```

### 4. Implementar el Adapter (Supabase)

```typescript
// infrastructure/repositories/supabase-loyalty.repository.ts
@Injectable()
export class SupabaseLoyaltyRepository implements ILoyaltyRepository {
  constructor(private readonly supabase: SupabaseService) {}
  // ... implementación SQL nativo
}
```

### 5. Implementar el Use Case

```typescript
// application/use-cases/earn-points.use-case.ts
@Injectable()
export class EarnPointsUseCase {
  async execute(command: { tenantId: string; customerId: string; saleAmount: number }): Promise<void> {
    // 1. Cargar/crear cuenta
    // 2. Calcular puntos
    // 3. Aplicar en agregado
    // 4. Persistir
    // 5. Publicar evento
  }
}
```

### 6. Registrar en el módulo (DIP)

```typescript
// loyalty.module.ts
@Module({
  providers: [
    { provide: LOYALTY_REPOSITORY, useClass: SupabaseLoyaltyRepository },
    EarnPointsUseCase,
    RedeemPointsUseCase,
  ],
  controllers: [LoyaltyController],
})
export class LoyaltyModule {}
```

### 7. Importar en AppModule

```typescript
// app.module.ts
import { LoyaltyModule } from './modules/loyalty/loyalty.module'

@Module({
  imports: [ ..., LoyaltyModule ],
})
export class AppModule {}
```

### 8. Escuchar eventos de venta

```typescript
// application/listeners/sale-completed.listener.ts
@Injectable()
export class SaleCompletedListener {
  @OnEvent('sale.completed')
  async handle(event: SaleCompletedEvent) {
    await this.earnPoints.execute({
      tenantId:    event.payload.tenantId,
      customerId:  event.payload.customerId,
      saleAmount:  event.payload.total.amount,
    })
  }
}
```

### 9. Agregar migración SQL

```sql
-- database/migrations/005_loyalty.sql
CREATE TABLE loyalty_accounts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  points      INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  tier        VARCHAR(20) DEFAULT 'BRONZE',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, customer_id)
);
ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_select" ON loyalty_accounts FOR SELECT USING (user_belongs_to_tenant(tenant_id));
```

---

## Reglas de módulos

1. **Nunca** importar un repositorio de otro módulo
2. **Siempre** comunicarse entre módulos vía `EventBusService`
3. **Siempre** usar el Symbol del repositorio como token de inyección (DIP)
4. **Siempre** agregar RLS policy para las nuevas tablas
5. **Siempre** incluir `tenant_id` y `created_by` en cada tabla
