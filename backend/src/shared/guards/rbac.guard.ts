import {
  Injectable, CanActivate, ExecutionContext,
  ForbiddenException, SetMetadata,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'

export const PERMISSIONS_KEY = 'permissions'
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions)

export const ROLES_KEY = 'roles'
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)

export const IS_PUBLIC_KEY = 'isPublic'
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

@Injectable()
export class RBACGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip guard on public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const req = context.switchToHttp().getRequest<Request>()
    const tenant = req.tenant

    if (!tenant) throw new ForbiddenException('Tenant context not found')

    // SUPER_ADMIN bypasses all permission checks
    if (tenant.userRole === 'SUPER_ADMIN') return true

    // ── Check required permissions ───────────────────────
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (requiredPermissions?.length) {
      const hasAll = requiredPermissions.every((p) => tenant.permissions.includes(p))
      if (!hasAll) {
        throw new ForbiddenException(
          `Missing permission(s): ${requiredPermissions.filter((p) => !tenant.permissions.includes(p)).join(', ')}`,
        )
      }
    }

    // ── Check required roles ─────────────────────────────
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (requiredRoles?.length) {
      if (!requiredRoles.includes(tenant.userRole)) {
        throw new ForbiddenException(`Role ${tenant.userRole} is not allowed`)
      }
    }

    return true
  }
}
