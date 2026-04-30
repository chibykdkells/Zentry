import { Injectable, Logger } from '@nestjs/common';
import { Tenant } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const TENANT_CACHE_TTL = 60; // 60 seconds
const PLATFORM_HOSTNAME =
  process.env['PLATFORM_DOMAIN'] ?? 'zendocx.net';

@Injectable()
export class TenantResolverService {
  private readonly logger = new Logger(TenantResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private isLocalDevelopmentHost(host: string): boolean {
    return host === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  }

  async resolveFromSlug(slug: string): Promise<Tenant | null> {
    const normalizedSlug = slug.trim().toLowerCase();
    if (!normalizedSlug) {
      return null;
    }

    return this.prisma.tenant.findFirst({
      where: {
        slug: normalizedSlug,
        isActive: true,
      },
    });
  }

  async resolveFromRequestContext(input: {
    hostname: string;
    explicitSlug?: string | null;
  }): Promise<Tenant | null> {
    const explicitSlug = input.explicitSlug?.trim();

    if (explicitSlug) {
      return this.resolveFromSlug(explicitSlug);
    }

    return this.resolveFromHostname(input.hostname);
  }

  /**
   * Resolves a Tenant from an incoming HTTP hostname.
   *
   * Resolution order:
   * 1. Check Redis cache (key: tenant:host:{hostname})
   * 2. Extract slug from subdomain: "testbiz.zendocx.net" → slug = "testbiz"
   * 3. Fall back to querying customDomain field
   *
   * Returns null for the platform's own hostname (admin dashboard traffic).
   */
  async resolveFromHostname(hostname: string): Promise<Tenant | null> {
    if (!hostname) return null;

    // Strip port from hostname if present (e.g., "testbiz.zendocx.net:3000")
    const host = hostname.split(':')[0];

    // Platform root domain and reserved subdomains — no tenant resolution
    const PLATFORM_SUBDOMAINS = ['www', 'api', 'app', 'mail', 'cdn', 'static'];
    if (
      host === PLATFORM_HOSTNAME ||
      PLATFORM_SUBDOMAINS.some((sub) => host === `${sub}.${PLATFORM_HOSTNAME}`)
    ) {
      return null;
    }

    // Local dev: localhost or IP addresses → no tenant (return null so dev works)
    if (this.isLocalDevelopmentHost(host)) {
      return null;
    }

    const cacheKey = `tenant:host:${host}`;

    // Try cache first
    const cached = await this.redis.getJson<Tenant>(cacheKey).catch(() => null);
    if (cached) return cached;

    let tenant: Tenant | null = null;

    // Try subdomain extraction: "testbiz.zendocx.net" → slug = "testbiz"
    if (host.endsWith(`.${PLATFORM_HOSTNAME}`)) {
      const slug = host.replace(`.${PLATFORM_HOSTNAME}`, '');
      if (slug) {
        tenant = await this.prisma.tenant
          .findFirst({
            where: {
              slug,
              isActive: true,
            },
          })
          .catch(() => null);
      }
    } else {
      // Custom domain lookup
      tenant = await this.prisma.tenant
        .findFirst({
          where: {
            customDomain: host,
            isActive: true,
          },
        })
        .catch(() => null);
    }

    if (tenant) {
      await this.redis.setJson(cacheKey, tenant, TENANT_CACHE_TTL).catch(() => {
        this.logger.warn(`Failed to cache tenant for host: ${host}`);
      });
    }

    return tenant;
  }

  /** Invalidate cached tenant resolution for a given hostname. */
  async invalidateCache(slug: string): Promise<void> {
    await this.redis
      .del(`tenant:host:${slug}.${PLATFORM_HOSTNAME}`)
      .catch(() => null);
  }
}
