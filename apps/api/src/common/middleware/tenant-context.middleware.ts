import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Tenant } from '@prisma/client';
import { TenantResolverService } from '../../modules/tenant/tenant-resolver.service';

// Extend Express Request to carry the resolved tenant
declare module 'express-serve-static-core' {
  interface Request {
    tenant: Tenant | null;
  }
}

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);

  constructor(private readonly resolver: TenantResolverService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const hostname = req.headers['host'] ?? '';
    const requestedTenantSlug =
      typeof req.headers['x-tenant-slug'] === 'string'
        ? req.headers['x-tenant-slug']
        : '';

    try {
      req.tenant = await this.resolver.resolveFromRequestContext({
        hostname,
        explicitSlug: requestedTenantSlug,
      });
    } catch (err) {
      this.logger.warn(
        `Tenant resolution failed for host "${hostname}": ${(err as Error).message}`,
      );
      req.tenant = null;
    }
    next();
  }
}
