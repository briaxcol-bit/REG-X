import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { SupabaseService } from '@shared/infrastructure/supabase/supabase.service'
import { CacheService } from '@shared/infrastructure/redis/cache.service'
import { RedisService } from '@shared/infrastructure/redis/redis.service'
import * as bcrypt from 'bcryptjs'

export interface TokenPair {
  accessToken:  string
  refreshToken: string
  expiresIn:    number
}

export interface AuthUser {
  id:       string
  email:    string
  fullName: string
  role?:    string
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly supabase: SupabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly redis: RedisService,
  ) {}

  // ── Login ────────────────────────────────────────────────

  async login(email: string, password: string): Promise<{ tokens: TokenPair; user: AuthUser }> {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const user: AuthUser = {
      id:       data.user.id,
      email:    data.user.email!,
      fullName: (data.user.user_metadata?.['full_name'] as string) ?? '',
    }

    const tokens = await this.generateTokens(user)

    // Track session
    await this.redis.setSessionData(
      `user:${user.id}:session`,
      { userId: user.id, loginAt: new Date().toISOString() },
      60 * 60 * 24 * 7, // 7 days
    )

    this.logger.log(`User ${email} logged in`)
    return { tokens, user }
  }

  // ── Register ─────────────────────────────────────────────

  async register(email: string, password: string, fullName: string): Promise<{ tokens: TokenPair; user: AuthUser }> {
    const { data, error } = await this.supabase.client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

    if (error) {
      if (error.message.includes('already registered')) {
        throw new ConflictException('Email already registered')
      }
      throw new Error(error.message)
    }

    if (!data.user) throw new Error('Registration failed')

    const user: AuthUser = { id: data.user.id, email, fullName }
    const tokens = await this.generateTokens(user)
    return { tokens, user }
  }

  // ── Refresh ──────────────────────────────────────────────

  async refresh(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = this.jwt.verify<AuthUser & { type: string }>(refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      })

      if (payload.type !== 'refresh') throw new Error('Not a refresh token')

      // Blacklist check
      const isBlacklisted = await this.cache.get<boolean>(`blacklist:${refreshToken.slice(-16)}`)
      if (isBlacklisted) throw new Error('Token revoked')

      return this.generateTokens({ id: payload.id, email: payload.email, fullName: payload.fullName })
    } catch {
      throw new UnauthorizedException('Invalid refresh token')
    }
  }

  // ── Logout ───────────────────────────────────────────────

  async logout(refreshToken: string): Promise<void> {
    // Blacklist the refresh token
    const expiresIn = 60 * 60 * 24 * 7
    await this.cache.set(`blacklist:${refreshToken.slice(-16)}`, true, expiresIn)
    await this.supabase.client.auth.signOut()
  }

  // ── Helpers ──────────────────────────────────────────────

  private async generateTokens(user: AuthUser): Promise<TokenPair> {
    const payload = { sub: user.id, id: user.id, email: user.email, fullName: user.fullName }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret:    this.config.getOrThrow('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_EXPIRES', '15m'),
      }),
      this.jwt.signAsync({ ...payload, type: 'refresh' }, {
        secret:    this.config.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES', '7d'),
      }),
    ])

    return { accessToken, refreshToken, expiresIn: 900 }
  }
}
