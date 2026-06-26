import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import type { TenantContext } from '@shared/middleware/tenant.middleware'

/**
 * Extracts the full TenantContext from request.
 *
 * @example
 * @Get()
 * async list(@Tenant() tenant: TenantContext) { ... }
 */
export const Tenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const req = ctx.switchToHttp().getRequest<Request>()
    if (!req.tenant) throw new Error('TenantContext not available — ensure TenantMiddleware is applied')
    return req.tenant
  },
)

/**
 * Extracts only the tenantId from TenantContext.
 */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request>()
    return req.tenant?.tenantId ?? ''
  },
)
