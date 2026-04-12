import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Ensures a tenant has been resolved from the request hostname before
 * the handler runs. Apply to controllers or routes that strictly require
 * a tenant context (all non-admin routes).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.tenant) {
      throw new BadRequestException('Unable to resolve tenant from request');
    }
    return true;
  }
}
