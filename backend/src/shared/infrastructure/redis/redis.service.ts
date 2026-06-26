import { Injectable, Inject, Logger } from '@nestjs/common'
import type { Redis } from 'ioredis'

/**
 * Low-level Redis service for Streams, pub/sub, and direct commands.
 */
@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name)

  constructor(
    @Inject('REDIS_CLIENT') private readonly client: Redis,
    @Inject('REDIS_STREAM_CLIENT') private readonly streamClient: Redis,
  ) {}

  // ── Redis Streams ────────────────────────────────────────

  async xadd(stream: string, id: string, data: Record<string, string>): Promise<string | null> {
    const args = Object.entries(data).flat()
    return this.streamClient.xadd(stream, id, ...args)
  }

  async xread(
    stream: string,
    count: number,
    lastId: string,
  ): Promise<Array<{ id: string; data: Record<string, string> }>> {
    const result = await this.streamClient.xread('COUNT', count, 'STREAMS', stream, lastId)
    if (!result) return []

    return (result[0]?.[1] as Array<[string, string[]]> ?? []).map(([id, fields]) => {
      const data: Record<string, string> = {}
      for (let i = 0; i < fields.length; i += 2) {
        data[fields[i]!] = fields[i + 1]!
      }
      return { id, data }
    })
  }

  async publishEvent(eventName: string, payload: Record<string, unknown>): Promise<void> {
    await this.xadd('regx:events', '*', {
      event:     eventName,
      payload:   JSON.stringify(payload),
      timestamp: new Date().toISOString(),
    })
  }

  // ── Pub/Sub ──────────────────────────────────────────────

  async publish(channel: string, message: unknown): Promise<void> {
    await this.client.publish(channel, JSON.stringify(message))
  }

  // ── Session / rate-limit helpers ─────────────────────────

  async setSessionData(sessionId: string, data: unknown, ttlSeconds: number): Promise<void> {
    await this.client.setex(`session:${sessionId}`, ttlSeconds, JSON.stringify(data))
  }

  async getSessionData<T>(sessionId: string): Promise<T | null> {
    const raw = await this.client.get(`session:${sessionId}`)
    return raw ? (JSON.parse(raw) as T) : null
  }

  async incrementRateLimit(key: string, windowSeconds: number): Promise<number> {
    const multi = this.client.multi()
    multi.incr(key)
    multi.expire(key, windowSeconds)
    const results = await multi.exec()
    return (results?.[0]?.[1] as number) ?? 0
  }

  get raw(): Redis { return this.client }
}
