import { BadRequestException } from '@nestjs/common';
import { CbtApprovalStatus, UserRole } from '@prisma/client';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let prisma: {
    user: {
      count: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    cbtProfile: {
      update: jest.Mock;
      findUnique: jest.Mock;
    };
    serviceCategoryModel: {
      findMany: jest.Mock;
    };
    cbtProfileServiceCategory: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    notification: {
      create: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let notificationsService: {
    pushNotificationToUser: jest.Mock;
  };
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      user: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      cbtProfile: {
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      serviceCategoryModel: {
        findMany: jest.fn(),
      },
      cbtProfileServiceCategory: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    };

    notificationsService = {
      pushNotificationToUser: jest.fn(),
    };

    service = new UsersService(
      prisma as never,
      notificationsService as never,
    );
  });

  it('requires supported categories before approving a CBT center', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'cbt-user-1',
      email: 'cbt@example.com',
      firstName: 'Prime',
      role: UserRole.CBT_CENTER,
      tenantId: 'tenant-1',
      cbtProfile: {
        id: 'profile-1',
        centerName: 'Prime CBT',
        approvalStatus: CbtApprovalStatus.PENDING,
        serviceCategoryAssignments: [],
      },
    });

    await expect(
      service.approveCbtCenter('admin-1', 'cbt-user-1', 'tenant-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.cbtProfile.update).not.toHaveBeenCalled();
  });

  it('uses the CBT tenant context when loading assignable categories for super admin review', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'cbt-user-1',
      role: UserRole.CBT_CENTER,
      tenantId: 'tenant-1',
    });
    prisma.serviceCategoryModel.findMany.mockResolvedValue([
      {
        id: 'platform-identity',
        tenantId: null,
        name: 'Identity',
        slug: 'identity-services',
      },
      {
        id: 'tenant-identity',
        tenantId: 'tenant-1',
        name: 'Identity',
        slug: 'identity-services',
      },
      {
        id: 'tenant-jamb',
        tenantId: 'tenant-1',
        name: 'JAMB',
        slug: 'jamb-services',
      },
    ]);

    const result = await service.getAssignableCbtServiceCategories(
      null,
      'cbt-user-1',
    );

    expect(prisma.serviceCategoryModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ tenantId: null }, { tenantId: 'tenant-1' }],
        }),
      }),
    );
    expect(result.data).toEqual([
      {
        id: 'tenant-identity',
        name: 'Identity',
        slug: 'identity-services',
      },
      {
        id: 'tenant-jamb',
        name: 'JAMB',
        slug: 'jamb-services',
      },
    ]);
  });
});
