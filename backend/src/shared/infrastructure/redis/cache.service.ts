import { Injectable, Inject, Logger } from '@nestjs/common'
import type { Redis } from 'ioredis'

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name)
  private readonly DEFAULT_TTL = 300 // 5 min

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key)
      return value ? (JSON.parse(value) as T) : null
    } catch (err) {
      this.logger.warn(`Cache GET error for key "${key}": ${String(err)}`)
      return null
    }
  }

  async set(key: string, value: unknown, ttlSeconds = this.DEFAULT_TTL): Promise<void> {
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value))
    } catch (err) {
      this.logger.warn(`Cache SET error for key "${key}": ${String(err)}`)
    }
  }

  async del(key: string): Promise<void> {
    try { await this.redis.del(key) }
    catch (err) { this.logger.warn(`Cache DEL error: ${String(err)}`) }
  }

  async delByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern)
      if (keys.length > 0) await this.redis.del(...keys)
    } catch (err) {
      this.logger.warn(`Cache DEL pattern error: ${String(err)}`)
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds = this.DEFAULT_TTL,
  ): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) return cached
    const value = await factory()
    await this.set(key, value, ttlSeconds)
    return value
  }

  /** Tenant-scoped cache key */
  tenantKey(tenantId: string, ...parts: string[]): string {
    return `tenant:${tenantId}:${parts.join(':')}`
  }
}
