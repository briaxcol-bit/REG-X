import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name)
  private _client!: SupabaseClient
  private _serviceClient!: SupabaseClient

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url     = this.config.getOrThrow<string>('SUPABASE_URL')
    const anonKey = this.config.getOrThrow<string>('SUPABASE_ANON_KEY')
    const svcKey  = this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY')

    this._client = createClient(url, anonKey, {
      auth: { persistSession: false },
    })

    // Service-role client bypasses RLS — use only in admin operations
    this._serviceClient = createClient(url, svcKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    this.logger.log('Supabase clients initialized')
  }

  /** Standard client (respects RLS) */
  get client(): SupabaseClient { return this._client }

  /** Admin client (bypasses RLS — use with caution) */
  get admin(): SupabaseClient { return this._serviceClient }

  /**
   * Get a client with the user's JWT injected.
   * This makes RLS evaluate as that specific user.
   */
  withAuth(accessToken: string): SupabaseClient {
    const url    = this.config.getOrThrow<string>('SUPABASE_URL')
    const anonKey = this.config.getOrThrow<string>('SUPABASE_ANON_KEY')
    const client = createClient(url, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
    return client
  }
}
