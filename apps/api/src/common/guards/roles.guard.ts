import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { UserRole, JwtUser } from '@zentry/types';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles decorator → route is open to any authenticated user
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: JwtUser }>();
    const user = request.user;

    // Role check
    if (!requiredRoles.includes(user?.role)) return false;

    // Tenant membership check — SUPER_ADMIN is always platform-level (no tenant)
    // For all other roles: the user's tenantId must match the resolved tenant
    if (user.role === UserRole.SUPER_ADMIN) return true;

    const resolvedTenantId = request.tenant?.id ?? null;

    // If a tenant was resolved from the hostname, the user must belong to it
    if (resolvedTenantId && user.tenantId !== resolvedTenantId) {
      throw new ForbiddenException('You do not have access to this tenant');
    }

    return true;
  }
}
