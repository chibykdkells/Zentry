import { Tenant } from '@prisma/client';
import { TenantResolverService } from './tenant-resolver.service';

describe('TenantResolverService', () => {
  const tenant: Tenant = {
    id: 'tenant-1',
    name: 'Test Biz',
    slug: 'testbiz',
    logoUrl: null,
    primaryColor: '#0D1B3E',
    accentColor: '#F5A623',
    textColor: '#10203C',
    buttonColor: '#0D1B3E',
    fontStyle: 'modern',
    homepageTemplate: 'spotlight',
    homepageHeading: 'Access Test Biz from one business portal',
    homepageSubheading:
      'Start with the public business homepage, review available services, then sign in or create your account when you are ready.',
    homepageAbout:
      'Test Biz uses ZenDocx to manage service requests, customer onboarding, and manual document workflows from one tenant-owned workspace.',
    homepageManualSteps: [],
    tenantMarginRate: 0,
    usesCustomServiceSelection: false,
    customDomain: 'portal.testbiz.com',
    customDomainVerified: true,
    isActive: true,
    createdById: 'admin-1',
    createdAt: new Date('2026-04-10T10:00:00.000Z'),
    updatedAt: new Date('2026-04-10T10:00:00.000Z'),
  };

  let prisma: {
    tenant: {
      findFirst: jest.Mock;
    };
  };
  let redis: {
    getJson: jest.Mock;
    setJson: jest.Mock;
    del: jest.Mock;
  };
  let service: TenantResolverService;

  beforeEach(() => {
    prisma = {
      tenant: {
        findFirst: jest.fn(),
      },
    };

    redis = {
      getJson: jest.fn(),
      setJson: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    service = new TenantResolverService(prisma as never, redis as never);
  });

  it('resolves explicit tenant slug regardless of host (localhost)', async () => {
    prisma.tenant.findFirst.mockResolvedValue(tenant);

    const result = await service.resolveFromRequestContext({
      hostname: 'localhost:3000',
      explicitSlug: 'testbiz',
    });

    expect(result).toEqual(tenant);
    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
      where: { slug: 'testbiz', isActive: true },
    });
  });

  it('resolves explicit tenant slug regardless of host (production www domain)', async () => {
    prisma.tenant.findFirst.mockResolvedValue(tenant);

    const result = await service.resolveFromRequestContext({
      hostname: 'www.zendocx.net',
      explicitSlug: 'testbiz',
    });

    expect(result).toEqual(tenant);
    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
      where: { slug: 'testbiz', isActive: true },
    });
  });

  it('resolves explicit tenant slug regardless of host (api subdomain)', async () => {
    prisma.tenant.findFirst.mockResolvedValue(tenant);

    const result = await service.resolveFromRequestContext({
      hostname: 'api.zendocx.net',
      explicitSlug: 'testbiz',
    });

    expect(result).toEqual(tenant);
    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
      where: { slug: 'testbiz', isActive: true },
    });
  });

  it('returns null for the platform root hostname', async () => {
    const result = await service.resolveFromHostname('zendocx.net');

    expect(result).toBeNull();
    expect(redis.getJson).not.toHaveBeenCalled();
    expect(prisma.tenant.findFirst).not.toHaveBeenCalled();
  });

  it('returns null for reserved platform subdomains', async () => {
    for (const sub of ['www', 'api', 'app', 'platform', 'admin']) {
      const result = await service.resolveFromHostname(`${sub}.zendocx.net`);
      expect(result).toBeNull();
    }
    expect(prisma.tenant.findFirst).not.toHaveBeenCalled();
  });

  it('resolves and caches subdomain tenants', async () => {
    redis.getJson.mockResolvedValue(null);
    prisma.tenant.findFirst.mockResolvedValue(tenant);

    const result = await service.resolveFromHostname('testbiz.zendocx.net');

    expect(result).toEqual(tenant);
    expect(redis.getJson).toHaveBeenCalledWith(
      'tenant:host:testbiz.zendocx.net',
    );
    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
      where: {
        slug: 'testbiz',
        isActive: true,
      },
    });
    expect(redis.setJson).toHaveBeenCalledWith(
      'tenant:host:testbiz.zendocx.net',
      tenant,
      60,
    );
  });

  it('falls back to custom domain lookup when needed', async () => {
    redis.getJson.mockResolvedValue(null);
    prisma.tenant.findFirst.mockResolvedValue(tenant);

    const result = await service.resolveFromHostname('portal.testbiz.com');

    expect(result).toEqual(tenant);
    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
      where: {
        customDomain: { in: ['portal.testbiz.com', 'www.portal.testbiz.com'] },
        customDomainVerified: true,
        isActive: true,
      },
    });
  });

  it('resolves www custom-domain aliases to the same verified tenant', async () => {
    redis.getJson.mockResolvedValue(null);
    prisma.tenant.findFirst.mockResolvedValue(tenant);

    const result = await service.resolveFromHostname('www.portal.testbiz.com');

    expect(result).toEqual(tenant);
    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
      where: {
        customDomain: { in: ['www.portal.testbiz.com', 'portal.testbiz.com'] },
        customDomainVerified: true,
        isActive: true,
      },
    });
  });

  it('does not resolve unverified custom domains', async () => {
    redis.getJson.mockResolvedValue(null);
    prisma.tenant.findFirst.mockResolvedValue(null);

    const result = await service.resolveFromHostname('Portal.TestBiz.com');

    expect(result).toBeNull();
    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
      where: {
        customDomain: { in: ['portal.testbiz.com', 'www.portal.testbiz.com'] },
        customDomainVerified: true,
        isActive: true,
      },
    });
  });
});
