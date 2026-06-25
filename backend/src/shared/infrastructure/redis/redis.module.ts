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
        const { default: Redis } = await import('ioredis')
        return new Redis({
          host:     config.get('REDIS_HOST', 'localhost'),
          port:     config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD') || undefined,
          db:       config.get<number>('REDIS_DB', 0),
          lazyConnect: true,
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => Math.min(times * 100, 3000),
        })
      },
    },
    {
      provide: 'REDIS_STREAM_CLIENT',
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const { default: Redis } = await import('ioredis')
        return new Redis({
          host:     config.get('REDIS_HOST', 'localhost'),
          port:     config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD') || undefined,
          db:       config.get<number>('REDIS_STREAM_DB', 1),
          lazyConnect: true,
        })
      },
    },
    RedisService,
    CacheService,
  ],
  exports: ['REDIS_CLIENT', 'REDIS_STREAM_CLIENT', RedisService, CacheService],
})
export class RedisModule {}
