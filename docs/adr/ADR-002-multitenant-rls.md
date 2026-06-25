# ADR-002: MultiTenant con Shared Database + Supabase RLS

**Estado**: Aceptado  
**Fecha**: 2024-01  

## Contexto

Tres estrategias posibles para multitenant:
1. **Database per tenant**: máximo aislamiento, costo alto, migraciones complejas
2. **Schema per tenant**: buen aislamiento, moderadamente caro en Supabase
3. **Shared database + RLS**: menor costo, aislamiento vía políticas SQL

## Decisión

**Shared database con Row-Level Security** usando Supabase PostgreSQL.

- Todas las tablas incluyen `tenant_id UUID NOT NULL`
- Supabase RLS filtra automáticamente las filas por `tenant_id` del JWT
- El backend usa el cliente `service_role` para operaciones admin que bypass RLS
- El cliente frontend usa el cliente `anon` con RLS activo

## Helper functions

```sql
-- Función que retorna los tenant_ids del usuario autenticado
CREATE FUNCTION get_user_tenant_ids() RETURNS UUID[] ...

-- Política ejemplo
CREATE POLICY "products_select" ON products
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));
```

## Consecuencias

✅ Costo mínimo por tenant (no hay schema duplicado)  
✅ Migraciones únicas para todos los tenants  
✅ Zero-downtime migrations con `ALTER TABLE ... ADD COLUMN DEFAULT`  
✅ Full text search y analytics agregadas sin joins cross-schema  

⚠️ Un bug en las políticas RLS podría filtrar datos entre tenants — se mitiga con tests de aislamiento  
⚠️ No cumple regulaciones que exigen separación física de datos (e.g. algunos sectores bancarios)
