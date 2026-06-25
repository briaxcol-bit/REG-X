import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ScheduleModule } from '@nestjs/schedule'
import { ServeStaticModule } from '@nestjs/serve-static'
import { join } from 'path'

// ── Feature modules ──────────────────────────────────────────
import { AuthModule } from '@modules/auth/auth.module'
import { TenantsModule } from '@modules/tenants/tenants.module'
import { UsersModule } from '@modules/users/users.module'
import { RolesModule } from '@modules/roles/roles.module'
import { ProductsModule } from '@modules/products/products.module'
import { InventoryModule } from '@modules/inventory/inventory.module'
import { POSModule } from '@modules/pos/pos.module'
import { CashRegisterModule } from '@modules/cash-register/cash-register.module'
import { CustomersModule } from '@modules/customers/customers.module'
import { ReportsModule } from '@modules/reports/reports.module'
import { SubscriptionsModule } from '@modules/subscriptions/subscriptions.module'
import { NotificationsModule } from '@modules/notifications/notifications.module'
import { AuditLogsModule } from '@modules/audit-logs/audit-logs.module'
import { WebhooksModule } from '@modules/webhooks/webhooks.module'
import { ApiKeysModule } from '@modules/api-keys/api-keys.module'
import { RestaurantModule } from '@modules/restaurant/restaurant.module'
import { BarModule } from '@modules/bar/bar.module'
import { PromotionsModule } from '@modules/promotions/promotions.module'
import { MarketplaceModule } from '@modules/marketplace/marketplace.module'
import { BillingModule } from '@modules/billing/billing.module'

// ── Shared infrastructure ────────────────────────────────────
import { SupabaseModule } from '@shared/infrastructure/supabase/supabase.module'
import { RedisModule } from '@shared/infrastructure/redis/redis.module'
import { EventBusModule } from '@shared/events/event-bus.module'

@Module({
  imports: [
    // ── Config ──────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../.env.local', '../.env'],
    }),

    // ── Rate limiting ────────────────────────────────────
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ([{
        ttl:   config.get<number>('THROTTLE_TTL', 60) * 1000,
        limit: config.get<number>('THROTTLE_LIMIT', 100),
      }]),
    }),

    // ── Event bus ────────────────────────────────────────
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.', maxListeners: 20 }),
    ScheduleModule.forRoot(),

    // ── Static frontend (producción: backend sirve el build de Vite) ──
    ...(process.env['NODE_ENV'] === 'production'
      ? [ServeStaticModule.forRoot({
          rootPath:     join(__dirname, '..', '..', 'frontend', 'dist'),
          exclude:      ['/api/(.*)'],
          serveStaticOptions: {
            fallthrough: true,  // SPA fallback → index.html
            index:       false,
          },
        })]
      : []),

    // ── Infrastructure ───────────────────────────────────
    SupabaseModule,
    RedisModule,
    EventBusModule,

    // ── Feature modules ──────────────────────────────────
    AuthModule,
    TenantsModule,
    UsersModule,
    RolesModule,
    ProductsModule,
    InventoryModule,
    POSModule,
    CashRegisterModule,
    CustomersModule,
    ReportsModule,
    SubscriptionsModule,
    NotificationsModule,
    AuditLogsModule,
    WebhooksModule,
    ApiKeysModule,
    RestaurantModule,
    BarModule,
    PromotionsModule,
    MarketplaceModule,
    BillingModule,
  ],
})
export class AppModule {}
