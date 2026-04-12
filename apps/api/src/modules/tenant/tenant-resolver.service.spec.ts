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

  it('resolves explicit tenant slug for localhost development', async () => {
    prisma.tenant.findFirst.mockResolvedValue(tenant);

    const result = await service.resolveFromRequestContext({
      hostname: 'localhost:3000',
      explicitSlug: 'testbiz',
    });

    expect(result).toEqual(tenant);
    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
      where: {
        slug: 'testbiz',
        isActive: true,
      },
    });
  });

  it('returns null for the platform hostname', async () => {
    const result = await service.resolveFromHostname('zentry.ng');

    expect(result).toBeNull();
    expect(redis.getJson).not.toHaveBeenCalled();
    expect(prisma.tenant.findFirst).not.toHaveBeenCalled();
  });

  it('resolves and caches subdomain tenants', async () => {
    redis.getJson.mockResolvedValue(null);
    prisma.tenant.findFirst.mockResolvedValue(tenant);

    const result = await service.resolveFromHostname('testbiz.zentry.ng');

    expect(result).toEqual(tenant);
    expect(redis.getJson).toHaveBeenCalledWith('tenant:host:testbiz.zentry.ng');
    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
      where: {
        slug: 'testbiz',
        isActive: true,
      },
    });
    expect(redis.setJson).toHaveBeenCalledWith(
      'tenant:host:testbiz.zentry.ng',
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
        customDomain: 'portal.testbiz.com',
        isActive: true,
      },
    });
  });
});
