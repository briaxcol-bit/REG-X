# ADR-003: POS Offline First con IndexedDB + Service Workers

**Estado**: Aceptado  
**Fecha**: 2024-01  

## Contexto

Los negocios (restaurantes, tiendas) frecuentemente experimentan cortes de internet. Un POS que deje de funcionar durante un corte es inaceptable comercialmente.

## Decisión

**Offline First** usando:
- **Dexie.js** (IndexedDB wrapper) para persistir productos y carrito localmente
- **Service Workers + Workbox** para cache de activos estáticos y API responses
- **Background Sync** para sincronizar ventas pendientes cuando regresa la conexión
- **Zustand con `persist`** para estado del carrito en localStorage

## Estrategia de sincronización

```
Online:  Venta → API → DB → ✅
Offline: Venta → LocalDB (pendingSync[]) → Service Worker Queue
         → Al recuperar conexión → Sync API → DB
```

## Conflictos de inventario offline

Si dos cajas venden el mismo último producto offline, al sincronizar el servidor valida stock real. Si hay conflicto:
1. La venta más antigua (timestamp) se acepta
2. La segunda venta se marca como "requiere revisión"
3. El cashier recibe notificación para resolver manualmente

## Consecuencias

✅ POS funciona 100% sin internet  
✅ Experiencia fluida para el usuario final  
✅ Pérdida cero de ventas por cortes de red  

⚠️ Complejidad de sync y resolución de conflictos  
⚠️ El inventario offline puede quedar desactualizado si hay múltiples cajas activas  

## Mitigación

- Sincronización automática cada 2 minutos cuando hay conexión
- Indicador visual claro de estado (online / offline / syncing)
- Alertas cuando una venta offline no puede sincronizarse
