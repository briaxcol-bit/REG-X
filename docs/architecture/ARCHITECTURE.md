# REG-X ERP/POS SaaS Enterprise — Arquitectura General

## Visión General

REG-X es una plataforma SaaS Enterprise para gestión de negocios (ERP/POS) diseñada con las siguientes propiedades fundamentales:

- **MultiTenant** — Aislamiento completo de datos por empresa (tenant)  
- **Offline First** — POS funciona sin internet; sincronización automática al reconectar  
- **Modular** — Módulos activables/desactivables por tenant  
- **Extensible** — Marketplace de módulos de terceros  
- **Escalable** — De un solo negocio a miles de sucursales concurrentes  

---

## Diagramas C4

### Nivel 1 — Contexto del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        REG-X Platform                           │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Cashier  │  │  Owner   │  │  Waiter  │  │  Chef / KDS  │  │
│  │  (POS)   │  │(Dashboard│  │(Tables)  │  │  (Kitchen)   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │              │              │                │           │
│  ┌────▼──────────────▼──────────────▼────────────────▼───────┐ │
│  │                  React PWA (Frontend)                      │ │
│  │  Offline First │ Service Workers │ IndexedDB              │ │
│  └──────────────────────────┬────────────────────────────────┘ │
│                              │                                  │
│  ┌───────────────────────────▼────────────────────────────────┐ │
│  │              Kong API Gateway                              │ │
│  │  Rate Limiting │ Auth │ CORS │ Compression                │ │
│  └──────────────────────────┬────────────────────────────────┘ │
│                              │                                  │
│  ┌───────────────────────────▼────────────────────────────────┐ │
│  │           NestJS Modular Monolith (Backend)                │ │
│  │  DDD │ Hex Architecture │ Clean Architecture │ EDA        │ │
│  └──┬───────────┬───────────────┬───────────────┬────────────┘ │
│     │           │               │               │               │
│  ┌──▼──┐  ┌────▼────┐   ┌──────▼──┐  ┌────────▼─────────┐    │
│  │Supa │  │  Redis  │   │ Redis   │  │   Supabase       │    │
│  │base │  │  Cache  │   │ Streams │  │   Realtime       │    │
│  │ DB  │  │         │   │(Events) │  │   Storage        │    │
│  └─────┘  └─────────┘   └─────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Nivel 2 — Módulos del Backend

```
Backend NestJS (Modular Monolith)
├── AuthModule          — JWT, MFA, Passkeys, Token Rotation
├── TenantsModule       — Multi-empresa, configuración por tenant
├── UsersModule         — Gestión de usuarios, invitaciones
├── RolesModule         — RBAC dinámico, permisos granulares
├── ProductsModule      — Catálogo, variantes, marcas, categorías
├── InventoryModule     — Stock, movimientos, transferencias
├── POSModule           — Ventas, pagos, checkout, recibos
├── CashRegisterModule  — Caja, apertura/cierre, diferencias
├── CustomersModule     — CRM, fidelización, historial
├── RestaurantModule    — Mesas, órdenes, mapa, reservas
├── BarModule           — Cócteles, barra, display bar
├── ReportsModule       — Dashboard, KPIs, reportes analíticos
├── PromotionsModule    — Motor de descuentos, cupones, combos
├── SubscriptionsModule — Planes SaaS, billing cycles, límites
├── WebhooksModule      — Notificaciones a sistemas externos
├── ApiKeysModule       — API pública con autenticación por clave
├── MarketplaceModule   — Registro e instalación de módulos
├── NotificationsModule — Push, in-app, email
└── AuditLogsModule     — Trazabilidad completa de acciones
```

### Nivel 3 — Arquitectura Hexagonal por Módulo

```
Cada módulo sigue:

┌─────────────────────────────────────────────┐
│              Presentation Layer              │
│  Controller → DTO → Response                │
│     (NestJS @Controller, Swagger)           │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│              Application Layer               │
│  Use Cases (one file per use case)          │
│  Commands / Queries (CQRS-inspired)         │
│  Application Services                       │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│                Domain Layer                  │
│  Entities (mutable, with behavior)          │
│  Aggregates (consistency boundary)          │
│  Value Objects (immutable)                  │
│  Domain Events                              │
│  Repository Interfaces (Ports)              │
│  Domain Services                            │
│  Specifications                             │
│  Factories                                  │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│             Infrastructure Layer             │
│  Supabase Repositories (Adapters)           │
│  Redis Cache / Streams                      │
│  External API Clients                       │
│  Event Bus (EventEmitter2)                  │
└─────────────────────────────────────────────┘
```

---

## Decisiones Arquitectónicas Clave

### 1. Modular Monolith → Microservicios
**Fase 1** arranca como Modular Monolith para:
- Menor complejidad de despliegue
- Desarrollo más rápido
- Transacciones ACID nativas

**Fase 2+**: cada módulo puede extraerse como microservicio independiente gracias a:
- Interfaces (Ports) explícitas
- Event-driven communication
- Sin dependencias circulares entre módulos

### 2. MultiTenant: Shared Database + Row-Level Security
Todos los datos viven en el mismo schema PostgreSQL con `tenant_id` en cada tabla. Supabase RLS garantiza aislamiento sin overhead de schema-per-tenant.

**Ventajas**: costos mínimos por tenant, zero-downtime migrations  
**Compensación**: ligeramente más complejo que schema-per-tenant

### 3. Offline First en POS
El POS usa Dexie.js (IndexedDB) para:
- Catálogo de productos cacheado localmente
- Carrito persistente incluso sin internet
- Cola de ventas pendientes de sync
- Service Worker para activos estáticos

### 4. Event-Driven para desacoplamiento
Los módulos se comunican vía `EventBusService` (EventEmitter2 internamente). En Fase 2 se migra a Redis Streams o Kafka sin cambiar la interfaz del dominio.

---

## Roadmap MVP → Enterprise

| Fase  | Alcance                                                       | ETA   |
|-------|---------------------------------------------------------------|-------|
| **1** | Auth, Tenants, POS, Inventario, Caja, Dashboard básico        | M 1-3 |
| **2** | Restaurante, KDS, Bar, CRM, Promociones, Fidelización         | M 4-6 |
| **3** | Marketplace, API Pública, Webhooks, App Flutter               | M 7-9 |
| **4** | Facturación electrónica, Multi-país, Multi-moneda avanzada    | M 10-12|
| **5** | IA Predictiva, Forecasting, ML para negocio                   | M 13+ |

---

## Stack Summary

| Capa            | Tecnología                                              |
|-----------------|----------------------------------------------------------|
| Frontend        | React 19, TypeScript, Vite, TailwindCSS, Shadcn/UI      |
| Estado          | Zustand + TanStack Query                                 |
| PWA             | Vite PWA Plugin, Workbox, Dexie.js                       |
| Backend         | NestJS, TypeScript, Passport, class-validator            |
| Base de datos   | Supabase PostgreSQL (RLS, Realtime, Storage)             |
| Cache           | Redis 7 (ioredis)                                        |
| Mensajería      | Redis Streams                                            |
| API Gateway     | Kong 3.5 (Declarative)                                   |
| Observabilidad  | OpenTelemetry + Prometheus + Grafana                     |
| Contenedores    | Docker + docker-compose (dev), Kubernetes (prod)         |
| CI/CD           | GitHub Actions → GHCR → Kubernetes Rolling Update        |
| Seguridad       | Supabase Auth, JWT RS256, RBAC, RLS, OWASP               |
