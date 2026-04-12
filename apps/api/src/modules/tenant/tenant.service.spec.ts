import { ForbiddenException } from '@nestjs/common';
import { Tenant } from '@prisma/client';
import { UserRole } from '@zentry/types';
import { TenantService } from './tenant.service';

describe('TenantService', () => {
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
      findUnique: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    order: {
      groupBy: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
    };
  };
  let resolver: {
    invalidateCache: jest.Mock;
  };
  let config: {
    get: jest.Mock;
  };
  let providerCredentialsService: {
    encrypt: jest.Mock;
    decrypt: jest.Mock;
  };
  let storageService: {
    uploadFile: jest.Mock;
    deleteFile: jest.Mock;
  };
  let service: TenantService;

  beforeEach(() => {
    prisma = {
      tenant: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      order: {
        groupBy: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    resolver = {
      invalidateCache: jest.fn(),
    };

    config = {
      get: jest.fn(),
    };

    providerCredentialsService = {
      encrypt: jest.fn((value: string) => value),
      decrypt: jest.fn((value: string) => value),
    };

    storageService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
    };

    service = new TenantService(
      prisma as never,
      resolver as never,
      config as never,
      providerCredentialsService as never,
      storageService as never,
    );
  });

  it('returns tenant overview metrics for a tenant admin', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      role: 'TENANT_ADMIN',
      tenantId: tenant.id,
    });
    prisma.tenant.findUnique.mockResolvedValue(tenant);
    prisma.user.count
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2);
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@test.com',
        role: UserRole.INDIVIDUAL,
        isActive: true,
        createdAt: new Date('2026-04-10T10:00:00.000Z'),
        lastLoginAt: new Date('2026-04-10T11:00:00.000Z'),
      },
    ]);
    prisma.order.groupBy.mockResolvedValue([
      { status: 'PENDING', _count: { _all: 2 } },
      { status: 'IN_PROGRESS', _count: { _all: 1 } },
      { status: 'COMPLETED', _count: { _all: 4 } },
      { status: 'DISPUTED', _count: { _all: 1 } },
    ]);

    const result = await service.getTenantOverviewForAdmin('tenant-admin-1');

    expect(result.message).toBe('Tenant overview retrieved');
    expect(result.data.metrics).toEqual({
      totalUsers: 8,
      individualUsers: 5,
      cbtUsers: 2,
      activeOrders: 3,
      completedOrders: 4,
      disputedOrders: 1,
      heldFunds: '0',
      availableBalance: '0',
      awaitingReleaseCount: 0,
      readyReleaseCount: 0,
      blockedReleaseCount: 0,
    });
    expect(result.data.tenant.slug).toBe('testbiz');
    expect(result.data.recentUsers).toHaveLength(1);
  });

  it('rejects tenant overview access for non-tenant-admin users', async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: UserRole.INDIVIDUAL,
      tenantId: tenant.id,
    });

    await expect(
      service.getTenantOverviewForAdmin('user-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updates tenant settings and invalidates tenant cache', async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: 'TENANT_ADMIN',
      tenantId: tenant.id,
    });
    prisma.tenant.findUnique
      .mockResolvedValueOnce(tenant)
      .mockResolvedValueOnce(null);
    prisma.tenant.update.mockResolvedValue({
      ...tenant,
      name: 'Updated Biz',
      customDomain: 'portal.updated.com',
      customDomainVerified: false,
      updatedAt: new Date('2026-04-10T12:00:00.000Z'),
    });
    prisma.auditLog.create.mockResolvedValue(null);

    const result = await service.updateOwnTenantSettings('tenant-admin-1', {
      name: 'Updated Biz',
      customDomain: 'portal.updated.com',
    });

    const updateCalls = prisma.tenant.update.mock.calls as unknown as Array<
      [
        {
          where: { id: string };
          data: {
            name: string;
            customDomain: string | null;
            customDomainVerified?: boolean;
          };
        },
      ]
    >;
    const updateInput = updateCalls[0][0];

    expect(updateInput).toEqual(
      expect.objectContaining({
        where: { id: tenant.id },
      }),
    );

    expect(updateInput.where.id).toBe(tenant.id);
    expect(updateInput.data.name).toBe('Updated Biz');
    expect(updateInput.data.customDomain).toBe('portal.updated.com');
    expect(updateInput.data.customDomainVerified).toBe(false);
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(resolver.invalidateCache).toHaveBeenCalledWith('testbiz');
    expect(result.data.name).toBe('Updated Biz');
  });
});
