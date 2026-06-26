import { Injectable, NestMiddleware, UnauthorizedException, ForbiddenException } from '@nestjs/common'
import type { Request, Response, NextFunction } from 'express'
import { SupabaseService } from '@shared/infrastructure/supabase/supabase.service'
import { CacheService } from '@shared/infrastructure/redis/cache.service'

export interface TenantContext {
  tenantId: string
  branchId?: string
  userId: string
  userRole: string
  permissions: string[]
  plan: string
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { tenant?: TenantContext }
  }
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly cache: CacheService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    // ── Extract auth header ──────────────────────────────
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return next() // Let guards handle unauthenticated routes
    }

    const token = authHeader.slice(7)

    try {
      // ── Verify JWT with Supabase ──────────────────────
      const { data: { user }, error } = await this.supabase.client.auth.getUser(token)
      if (error || !user) throw new UnauthorizedException('Invalid token')

      const tenantId = req.headers['x-tenant-id'] as string | undefined
      const branchId = req.headers['x-branch-id'] as string | undefined

      if (!tenantId) {
        // Platform-level route — still attach userId
        req.tenant = {
          tenantId: '',
          branchId,
          userId:      user.id,
          userRole:    'PLATFORM',
          permissions: [],
          plan:        '',
        }
        return next()
      }

      // ── Load tenant context from cache ────────────────
      const cacheKey = this.cache.tenantKey(tenantId, 'user-context', user.id)
      let ctx = await this.cache.get<TenantContext>(cacheKey)

      if (!ctx) {
        // ── Fetch from DB ────────────────────────────────
        const { data, error: dbError } = await this.supabase.admin
          .from('user_tenant_roles')
          .select(`
            role,
            tenant:tenants (plan),
            role_permissions:roles (
              permissions (permission_key)
            )
          `)
          .eq('user_id', user.id)
          .eq('tenant_id', tenantId)
          .single()

        if (dbError || !data) {
          throw new ForbiddenException('Access denied to this tenant')
        }

        const permissions: string[] =
          (data.role_permissions as any)?.permissions?.map((p: any) => p.permission_key) ?? []

        ctx = {
          tenantId,
          branchId,
          userId:      user.id,
          userRole:    data.role as string,
          permissions,
          plan:        (data.tenant as any)?.plan ?? 'FREE',
        }

        await this.cache.set(cacheKey, ctx, 300) // 5 min TTL
      }

      req.tenant = { ...ctx, branchId: branchId ?? ctx.branchId }
      next()
    } catch (err) {
      if (err instanceof UnauthorizedException || err instanceof ForbiddenException) throw err
      throw new UnauthorizedException('Authentication failed')
    }
  }
}
