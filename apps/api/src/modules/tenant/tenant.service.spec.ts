import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Tenant } from '@prisma/client';
import { UserRole } from '@zendocx/types';
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
      findUnique: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    order: {
      groupBy: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    wallet: {
      aggregate: jest.Mock;
    };
    transaction: {
      count: jest.Mock;
    };
    withdrawalRequest: {
      count: jest.Mock;
    };
    dispute: {
      count: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
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
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      order: {
        groupBy: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      wallet: {
        aggregate: jest.fn(),
      },
      transaction: {
        count: jest.fn(),
      },
      withdrawalRequest: {
        count: jest.fn(),
      },
      dispute: {
        count: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (ops: unknown[]) =>
        Promise.all(ops),
      ),
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
    prisma.wallet.aggregate
      .mockResolvedValueOnce({ _sum: { escrowBalance: 0n } })
      .mockResolvedValueOnce({ _sum: { availableBalance: 0n } });
    prisma.order.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prisma.order.findMany.mockResolvedValue([]);

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
    expect(resolver.invalidateCache).toHaveBeenCalledWith({
      slug: 'testbiz',
      customDomains: ['portal.testbiz.com', 'portal.updated.com'],
    });
    expect(result.data.name).toBe('Updated Biz');
  });

  it('returns DNS verification instructions for a saved custom domain', async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: UserRole.TENANT_ADMIN,
      tenantId: tenant.id,
      adminPermissions: ['MANAGE_BUSINESS_SETTINGS'],
    });
    prisma.tenant.findUnique.mockResolvedValue(tenant);
    config.get.mockImplementation((key: string) =>
      key === 'DOMAIN_VERIFICATION_SECRET' ? 'test-domain-secret' : undefined,
    );
    jest
      .spyOn(service as never, 'resolveTxtRecords')
      .mockResolvedValue(['zendocx-site-verification=other-token'] as never);

    const result = await service.getOwnTenantDomainVerification('tenant-admin-1');

    expect(result.message).toBe('Custom domain verification details retrieved.');
    expect(result.data).toEqual(
      expect.objectContaining({
        customDomain: 'portal.testbiz.com',
        customDomainVerified: true,
        recordType: 'TXT',
        recordHost: '_zendocx-verify.portal.testbiz.com',
        recordValue: expect.stringMatching(/^zendocx-site-verification=/),
        verificationStatus: 'VERIFIED',
        verificationService: {
          secretSource: 'DOMAIN_VERIFICATION_SECRET',
          dedicatedSecretConfigured: true,
          canVerifyReliably: true,
          message:
            'The platform verification secret is configured and ready for production domain checks.',
        },
        dnsLookup: expect.objectContaining({
          checkedAt: expect.any(String),
          expectedValueFound: false,
          recordsFound: ['zendocx-site-verification=other-token'],
          errorCode: null,
          errorMessage: null,
        }),
      }),
    );
  });

  it('marks a tenant custom domain as verified when the DNS TXT record matches', async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: UserRole.TENANT_ADMIN,
      tenantId: tenant.id,
      adminPermissions: ['MANAGE_BUSINESS_SETTINGS'],
    });
    prisma.tenant.findUnique.mockResolvedValue({
      ...tenant,
      customDomainVerified: false,
    });
    config.get.mockImplementation((key: string) =>
      key === 'DOMAIN_VERIFICATION_SECRET' ? 'test-domain-secret' : undefined,
    );
    prisma.tenant.update.mockResolvedValue({
      ...tenant,
      customDomainVerified: true,
    });
    prisma.auditLog.create.mockResolvedValue(null);
    const expectedRecordValue = (
      service as never as {
        buildDomainVerificationData: (value: Tenant) => { recordValue: string };
      }
    ).buildDomainVerificationData({
      ...tenant,
      customDomainVerified: false,
    }).recordValue;
    jest
      .spyOn(service as never, 'resolveTxtRecords')
      .mockResolvedValue([expectedRecordValue] as never);

    const verification = await service.getOwnTenantDomainVerification(
      'tenant-admin-1',
    );

    const result = await service.verifyOwnTenantCustomDomain('tenant-admin-1');

    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: tenant.id },
      data: { customDomainVerified: true },
    });
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(resolver.invalidateCache).toHaveBeenCalledWith({
      slug: 'testbiz',
      customDomains: ['portal.testbiz.com'],
    });
    expect(result.data.tenant.customDomainVerified).toBe(true);
    expect(result.data.verification?.customDomainVerified).toBe(true);
  });

  it('rejects verification when the DNS TXT record does not match', async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: UserRole.TENANT_ADMIN,
      tenantId: tenant.id,
      adminPermissions: ['MANAGE_BUSINESS_SETTINGS'],
    });
    prisma.tenant.findUnique.mockResolvedValue({
      ...tenant,
      customDomainVerified: false,
    });
    config.get.mockImplementation((key: string) =>
      key === 'DOMAIN_VERIFICATION_SECRET' ? 'test-domain-secret' : undefined,
    );

    jest
      .spyOn(service as never, 'resolveTxtRecords')
      .mockResolvedValue(['zendocx-site-verification=wrong-token'] as never);

    await expect(
      service.verifyOwnTenantCustomDomain('tenant-admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates a tenant user role for a tenant admin', async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: UserRole.TENANT_ADMIN,
      tenantId: tenant.id,
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-2',
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@test.com',
      role: UserRole.INDIVIDUAL,
      cbtProfile: {
        id: 'cbt-1',
      },
    });
    prisma.user.update.mockResolvedValue({
      id: 'user-2',
      role: UserRole.CBT_CENTER,
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@test.com',
      phone: '+2348000000007',
      isEmailVerified: true,
      isPhoneVerified: false,
      isActive: true,
      createdAt: new Date('2026-04-10T10:00:00.000Z'),
      lastLoginAt: null,
    });
    prisma.auditLog.create.mockResolvedValue(null);

    const result = await service.updateTenantUserRoleForAdmin(
      'tenant-admin-1',
      'user-2',
      UserRole.CBT_CENTER,
    );

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-2' },
        data: { role: UserRole.CBT_CENTER },
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(result.data.role).toBe(UserRole.CBT_CENTER);
  });

  it('rejects tenant user deletion when the user has finance or order history', async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: UserRole.TENANT_ADMIN,
      tenantId: tenant.id,
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-3',
      firstName: 'Ada',
      lastName: 'Byron',
      email: 'ada.byron@test.com',
      role: UserRole.INDIVIDUAL,
    });
    prisma.order.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    prisma.transaction.count.mockResolvedValue(0);
    prisma.withdrawalRequest.count.mockResolvedValue(0);
    prisma.dispute.count.mockResolvedValue(0);

    await expect(
      service.deleteTenantUserForAdmin('tenant-admin-1', 'user-3'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('toggles tenant user active state for a platform admin', async () => {
    prisma.tenant.findUnique.mockResolvedValue(tenant);
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-4',
      firstName: 'Kemi',
      lastName: 'Ade',
      role: UserRole.INDIVIDUAL,
      isActive: true,
    });
    prisma.user.update.mockResolvedValue({
      id: 'user-4',
      isActive: false,
    });
    prisma.auditLog.create.mockResolvedValue(null);

    const result = await service.toggleTenantUserActiveForPlatformAdmin(
      'admin-1',
      tenant.id,
      'user-4',
    );

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.data).toEqual({ id: 'user-4', isActive: false });
  });
});
