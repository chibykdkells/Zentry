import { UseGuards, applyDecorators } from '@nestjs/common';
import { TenantGuard } from '../guards/tenant.guard';

/**
 * Shorthand decorator that applies TenantGuard to a controller or route handler.
 * Use on any endpoint that must have a resolved tenant context.
 *
 * @example
 * @RequiresTenant()
 * @Post('register')
 * async register(...) { ... }
 */
export function RequiresTenant() {
  return applyDecorators(UseGuards(TenantGuard));
}
