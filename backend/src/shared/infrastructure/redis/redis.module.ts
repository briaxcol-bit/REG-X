import { Module, Global } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RedisService } from './redis.service'
import { CacheService } from './cache.service'

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        // Mock de Redis para desarrollo local sin Docker
        return new Proxy({}, {
          get(target, prop) {
            if (prop === 'multi') return () => ({ incr: () => {}, expire: () => {}, exec: async () => [] });
            if (prop === 'status') return 'ready';
            if (prop === 'on') return () => {};
            return async () => null;
          }
        }) as any;
      },
    },
    {
      provide: 'REDIS_STREAM_CLIENT',
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        // Mock de Redis para desarrollo local sin Docker
        return new Proxy({}, {
          get(target, prop) {
            if (prop === 'status') return 'ready';
            if (prop === 'on') return () => {};
            return async () => null;
          }
        }) as any;
      },
    },
    RedisService,
    CacheService,
  ],
  exports: ['REDIS_CLIENT', 'REDIS_STREAM_CLIENT', RedisService, CacheService],
})
export class RedisModule {}
