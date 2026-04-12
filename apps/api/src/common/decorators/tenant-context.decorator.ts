import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { Tenant } from '@prisma/client';

/**
 * Injects the resolved Tenant from the current request into a controller param.
 *
 * @example
 * async myHandler(@TenantContext() tenant: Tenant | null) { ... }
 */
export const TenantContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Tenant | null => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.tenant ?? null;
  },
);
