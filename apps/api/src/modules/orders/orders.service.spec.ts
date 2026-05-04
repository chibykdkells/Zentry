/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  CbtApprovalStatus,
  DisputeStatus,
  FulfillmentType,
  OrderStatus,
  ServiceDeliveryMode,
  TransactionStatus,
  TransactionType,
  UserRole,
} from '@prisma/client';
import { OrdersService } from './orders.service';

const buildApprovedCbtUser = (
  categorySlugs: string[] = ['identity-services'],
) => ({
  id: 'cbt-1',
  role: UserRole.CBT_CENTER,
  cbtProfile: {
    centerName: 'Prime CBT',
    approvalStatus: CbtApprovalStatus.APPROVED,
    serviceCategoryAssignments: categorySlugs.map((slug, index) => ({
      serviceCategory: {
        id: `cat-${index + 1}`,
        name: slug,
        slug,
      },
    })),
  },
  cbtStaffProfile: null,
});

const buildOrderDetailRecord = (overrides: Record<string, unknown> = {}) => {
  const base = {
    id: 'order-1',
    orderNumber: 'ORD-1001',
    status: OrderStatus.COMPLETED,
    deliveryMode: ServiceDeliveryMode.CBT_MANUAL,
    fulfillmentType: FulfillmentType.MANUAL,
    submittedData: { nin: '12345678901' },
    requesterDocUrls: ['https://files.example/request.pdf'],
    resultFileUrl: 'https://files.example/result.pdf',
    resultUploadedAt: new Date('2026-05-01T10:00:00.000Z'),
    totalAmount: 5000n,
    platformFee: 1000n,
    cbtCommission: 2000n,
    escrowReleasedAt: null,
    disputeWindowExpiresAt: new Date('2026-05-01T12:00:00.000Z'),
    assignedAt: new Date('2026-05-01T09:00:00.000Z'),
    completedAt: new Date('2026-05-01T10:00:00.000Z'),
    providerReference: null,
    providerResponse: null,
    cbtNotes: null,
    adminNotes: null,
    createdAt: new Date('2026-05-01T08:00:00.000Z'),
    updatedAt: new Date('2026-05-01T10:00:00.000Z'),
    service: {
      id: 'service-1',
      name: 'Identity Validation',
      slug: 'identity-validation',
      deliveryMode: ServiceDeliveryMode.CBT_MANUAL,
      fulfillmentType: FulfillmentType.MANUAL,
      requiredFields: [],
      requiredDocuments: [],
      category: {
        id: 'cat-1',
        name: 'Identity',
        slug: 'identity-services',
      },
    },
    tenant: {
      id: 'tenant-1',
      name: 'Zen Business',
      slug: 'zen-business',
    },
    requester: {
      id: 'user-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '+2348012345678',
      role: UserRole.INDIVIDUAL,
    },
    assignedCbt: {
      id: 'cbt-1',
      firstName: 'Prime',
      lastName: 'Center',
      email: 'cbt@example.com',
      phone: '+2348098765432',
      cbtProfile: {
        centerName: 'Prime CBT',
        approvalStatus: CbtApprovalStatus.APPROVED,
      },
    },
    transactions: [],
    dispute: null,
  };

  return {
    ...base,
    ...overrides,
    service: {
      ...base.service,
      ...(overrides.service as Record<string, unknown> | undefined),
      category: {
        ...base.service.category,
        ...((
          overrides.service as
            | { category?: Record<string, unknown> }
            | undefined
        )?.category ?? {}),
      },
    },
    tenant:
      overrides.tenant === null
        ? null
        : {
            ...base.tenant,
            ...((overrides.tenant as Record<string, unknown>) ?? {}),
          },
    requester: {
      ...base.requester,
      ...((overrides.requester as Record<string, unknown>) ?? {}),
    },
    assignedCbt:
      overrides.assignedCbt === null
        ? null
        : {
            ...base.assignedCbt,
            ...((overrides.assignedCbt as Record<string, unknown>) ?? {}),
            cbtProfile: {
              ...base.assignedCbt.cbtProfile,
              ...((
                overrides.assignedCbt as
                  | { cbtProfile?: Record<string, unknown> }
                  | undefined
              )?.cbtProfile ?? {}),
            },
          },
    dispute:
      overrides.dispute === null
        ? null
        : overrides.dispute
          ? {
              id: 'dispute-1',
              status: DisputeStatus.OPEN,
              reason: 'Wrong result',
              evidenceUrls: [],
              resolutionNote: null,
              createdAt: new Date('2026-05-01T10:30:00.000Z'),
              updatedAt: new Date('2026-05-01T10:30:00.000Z'),
              resolvedAt: null,
              redoDeadline: null,
              redoCompletedAt: null,
              ...(overrides.dispute as Record<string, unknown>),
            }
          : null,
    transactions: (overrides.transactions as unknown[]) ?? base.transactions,
  };
};

describe('OrdersService', () => {
  let prisma: {
    tenant: {
      findUnique: jest.Mock;
    };
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
    };
    service: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    order: {
      count: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
    cbtJobBlock: {
      findUnique: jest.Mock;
    };
    wallet: {
      findUnique: jest.Mock;
    };
    uploadedOrderFile: {
      createMany: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let storageService: {
    uploadFile: jest.Mock;
    deleteFile: jest.Mock;
  };
  let ordersReleaseQueueService: {
    scheduleReleaseForOrder: jest.Mock;
    removeScheduledReleaseForOrder: jest.Mock;
  };
  let ordersDeadlineQueueService: {
    scheduleDeadline: jest.Mock;
    cancelDeadline: jest.Mock;
  };
  let notificationsService: {
    broadcastWalletUpdated: jest.Mock;
    broadcastNewJob: jest.Mock;
    pushNotificationToUser: jest.Mock;
    emitEventToUser: jest.Mock;
    broadcastClaimedJob: jest.Mock;
  };
  let emailService: {
    sendEmail: jest.Mock;
  };
  let smsService: {
    sendSms: jest.Mock;
  };
  let service: OrdersService;

  beforeEach(() => {
    prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      service: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      order: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      cbtJobBlock: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      wallet: {
        findUnique: jest.fn(),
      },
      uploadedOrderFile: {
        createMany: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    storageService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    ordersReleaseQueueService = {
      scheduleReleaseForOrder: jest.fn(),
      removeScheduledReleaseForOrder: jest.fn(),
    };

    ordersDeadlineQueueService = {
      scheduleDeadline: jest.fn(),
      cancelDeadline: jest.fn(),
    };

    notificationsService = {
      broadcastWalletUpdated: jest.fn(),
      broadcastNewJob: jest.fn(),
      pushNotificationToUser: jest.fn(),
      emitEventToUser: jest.fn(),
      broadcastClaimedJob: jest.fn(),
    };

    emailService = {
      sendEmail: jest.fn().mockResolvedValue(undefined),
    };

    smsService = {
      sendSms: jest.fn().mockResolvedValue(undefined),
    };

    service = new OrdersService(
      prisma as never,
      {
        get: jest.fn((key: string, fallback?: string) => {
          if (key === 'API_URL') return 'http://localhost:4000';
          if (key === 'JWT_ACCESS_SECRET') return 'test-jwt-secret';
          return fallback;
        }),
      } as never,
      storageService as never,
      ordersReleaseQueueService as never,
      ordersDeadlineQueueService as never,
      {} as never,
      notificationsService as never,
      emailService as never,
      smsService as never,
    );
  });

  it('filters the CBT job pool to the center supported categories', async () => {
    prisma.user.findFirst.mockResolvedValue(
      buildApprovedCbtUser(['identity-services', 'jamb-services']),
    );
    prisma.order.count.mockResolvedValue(1);
    prisma.order.findMany.mockResolvedValue([]);

    await service.getCbtJobPool('cbt-1', { page: 1, limit: 10 }, 'tenant-1');

    expect(prisma.order.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        fulfillmentType: 'MANUAL',
        assignedCbtId: null,
        status: OrderStatus.PENDING,
        tenantId: 'tenant-1',
        service: {
          category: {
            slug: {
              in: ['identity-services', 'jamb-services'],
            },
          },
        },
      }),
    });
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          service: {
            category: {
              slug: {
                in: ['identity-services', 'jamb-services'],
              },
            },
          },
        }),
      }),
    );
  });

  it('rejects claiming jobs outside the CBT supported categories', async () => {
    prisma.user.findFirst.mockResolvedValue(
      buildApprovedCbtUser(['identity-services']),
    );
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      tenantId: 'tenant-1',
      service: {
        category: {
          slug: 'waec-services',
        },
      },
    });

    await expect(
      service.claimCbtJob('cbt-1', 'order-1', 'tenant-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('blocks direct pending-job access when the category is unsupported', async () => {
    prisma.user.findFirst.mockResolvedValue(
      buildApprovedCbtUser(['identity-services']),
    );
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(
      service.getCbtOrderDetail('cbt-1', 'order-1', 'tenant-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            expect.objectContaining({
              assignedCbtId: null,
              status: OrderStatus.PENDING,
              service: {
                category: {
                  slug: {
                    in: ['identity-services'],
                  },
                },
              },
            }),
            { assignedCbtId: 'cbt-1' },
          ],
        }),
      }),
    );
  });

  it('locks escrow and broadcasts a new job when a manual order is created', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '+2348012345678',
      wallet: {
        id: 'wallet-1',
        availableBalance: 9000n,
        escrowBalance: 1000n,
      },
    });
    prisma.service.findFirst.mockResolvedValue({
      id: 'service-1',
      name: 'Identity Validation',
      slug: 'identity-validation',
      totalPrice: 5000n,
      providerCost: 3000n,
      platformFee: 1000n,
      platformFeePercent: 20,
      cbtCommission: 2000n,
      providerKey: null,
      deliveryMode: ServiceDeliveryMode.CBT_MANUAL,
      fulfillmentType: FulfillmentType.MANUAL,
      isActive: true,
      requiredFields: [{ name: 'nin', label: 'NIN', required: true }],
      requiredDocuments: [{ name: 'idCard', label: 'ID Card', required: true }],
      category: {
        name: 'Identity',
        slug: 'identity-services',
      },
    });

    const tx = {
      order: {
        create: jest.fn().mockResolvedValue({
          id: 'order-1',
          orderNumber: 'ORD-1001',
          status: OrderStatus.PENDING,
          totalAmount: 5000n,
          platformFee: 1000n,
          cbtCommission: 2000n,
          createdAt: new Date('2026-05-01T08:00:00.000Z'),
          service: {
            name: 'Identity Validation',
            slug: 'identity-validation',
            category: {
              name: 'Identity',
              slug: 'identity-services',
            },
          },
        }),
      },
      wallet: {
        update: jest.fn().mockResolvedValue(undefined),
      },
      transaction: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      notification: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      uploadedOrderFile: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const result = await service.createOrder(
      'user-1',
      {
        serviceId: 'service-1',
        submittedData: { nin: '12345678901' },
        requesterDocuments: {
          idCard: {
            url: 'https://files.example/id-card.pdf',
            filename: 'id-card.pdf',
            publicId: 'doc-public-id',
          },
        },
      },
      'tenant-1',
    );

    expect(tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requesterDocUrls: [
          {
            name: 'idCard',
            label: 'ID Card',
            url: 'https://files.example/id-card.pdf',
            filename: 'id-card.pdf',
            publicId: 'doc-public-id',
          },
        ],
      }),
      select: expect.any(Object),
    });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: {
        availableBalance: 4000n,
        escrowBalance: 6000n,
      },
    });
    expect(tx.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: TransactionType.ESCROW_LOCK,
          status: TransactionStatus.SUCCESS,
          amount: 5000n,
          userId: 'user-1',
          tenantId: 'tenant-1',
        }),
      }),
    );
    expect(notificationsService.broadcastWalletUpdated).toHaveBeenCalledWith(
      'user-1',
    );
    expect(notificationsService.broadcastNewJob).toHaveBeenCalledWith({
      orderId: 'order-1',
      serviceId: 'service-1',
      serviceName: 'Identity Validation',
      tenantId: 'tenant-1',
    });
    expect(emailService.sendEmail).toHaveBeenCalled();
    expect(smsService.sendSms).toHaveBeenCalled();
    expect(result.message).toBe(
      'Order created successfully and payment moved into escrow.',
    );
  });

  it('prefers the tenant service override when an order is submitted with a platform service id', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '+2348012345678',
      wallet: {
        id: 'wallet-1',
        availableBalance: 500000n,
        escrowBalance: 0n,
      },
    });
    prisma.service.findFirst
      .mockResolvedValueOnce({
        id: 'service-platform',
        tenantId: null,
        name: 'Jamb Result',
        slug: 'jamb-result',
        totalPrice: 0n,
        providerCost: 0n,
        platformFee: 0n,
        platformFeePercent: 10,
        cbtCommission: 0n,
        providerKey: null,
        deliveryMode: ServiceDeliveryMode.CBT_MANUAL,
        fulfillmentType: FulfillmentType.MANUAL,
        isActive: true,
        requiredFields: [],
        requiredDocuments: [],
        category: {
          name: 'JAMB SERVICES',
          slug: 'jamb-services',
        },
      })
      .mockResolvedValueOnce({
        id: 'service-tenant',
        tenantId: 'tenant-1',
        name: 'Jamb Result',
        slug: 'jamb-result',
        totalPrice: 300000n,
        providerCost: 90000n,
        platformFee: 21000n,
        platformFeePercent: 10,
        cbtCommission: 120000n,
        providerKey: null,
        deliveryMode: ServiceDeliveryMode.CBT_MANUAL,
        fulfillmentType: FulfillmentType.MANUAL,
        isActive: true,
        requiredFields: [],
        requiredDocuments: [],
        category: {
          name: 'JAMB SERVICES',
          slug: 'jamb-services',
        },
      });

    const tx = {
      order: {
        create: jest.fn().mockResolvedValue({
          id: 'order-tenant',
          orderNumber: 'ORD-TENANT',
          status: OrderStatus.PENDING,
          totalAmount: 300000n,
          platformFee: 21000n,
          cbtCommission: 120000n,
          createdAt: new Date('2026-05-04T00:00:00.000Z'),
          service: {
            name: 'Jamb Result',
            slug: 'jamb-result',
            category: {
              name: 'JAMB SERVICES',
              slug: 'jamb-services',
            },
          },
        }),
      },
      wallet: {
        update: jest.fn().mockResolvedValue(undefined),
      },
      transaction: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      notification: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const result = await service.createOrder(
      'user-1',
      {
        serviceId: 'service-platform',
        submittedData: {},
      },
      'tenant-1',
    );

    expect(prisma.service.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        tenantId: 'tenant-1',
        slug: 'jamb-result',
      },
      select: expect.any(Object),
    });
    expect(tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        serviceId: 'service-tenant',
        totalAmount: 300000n,
        cbtCommission: 120000n,
      }),
      select: expect.any(Object),
    });
    expect(notificationsService.broadcastNewJob).toHaveBeenCalledWith({
      orderId: 'order-tenant',
      serviceId: 'service-tenant',
      serviceName: 'Jamb Result',
      tenantId: 'tenant-1',
    });
    expect(result.data.totalAmount).toBe('300000');
    expect(result.data.cbtCommission).toBe('120000');
  });

  it('flags affected orders for manual review when tenant pricing changed after the order was created', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'order-1',
        tenantId: 'tenant-1',
        orderNumber: 'ORD-1',
        status: OrderStatus.PENDING,
        createdAt: new Date('2026-05-01T10:00:00.000Z'),
        totalAmount: 0n,
        platformFee: 0n,
        cbtCommission: 0n,
        escrowReleasedAt: null,
        service: {
          id: 'platform-service',
          tenantId: null,
          slug: 'jamb-result',
          name: 'Jamb Result',
        },
        requester: {
          id: 'user-1',
          email: 'ada@example.com',
          wallet: {
            id: 'wallet-1',
            availableBalance: 10000n,
            escrowBalance: 0n,
          },
        },
        dispute: null,
        transactions: [],
      },
    ]);
    prisma.service.findMany.mockResolvedValue([
      {
        id: 'tenant-service',
        tenantId: 'tenant-1',
        slug: 'jamb-result',
        totalPrice: 300000n,
        providerCost: 100000n,
        platformFeePercent: 10,
        cbtCommission: 150000n,
        isActive: true,
        updatedAt: new Date('2026-05-02T10:00:00.000Z'),
      },
    ]);

    const result = await service.getAdminOrderPricingRemediationPreview(null);

    expect(result.data.summary).toEqual({
      affectedCount: 1,
      autoFixCount: 0,
      manualReviewCount: 1,
    });
    expect(result.data.candidates[0]).toMatchObject({
      orderId: 'order-1',
      action: 'MANUAL_REVIEW',
    });
    expect(result.data.candidates[0].reasons[0]).toContain(
      'changed after this order was created',
    );
  });

  it('applies pricing remediation by moving the missing amount into escrow and updating the order snapshot', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'order-1',
        tenantId: 'tenant-1',
        orderNumber: 'ORD-1',
        status: OrderStatus.PENDING,
        createdAt: new Date('2026-05-03T10:00:00.000Z'),
        totalAmount: 0n,
        platformFee: 0n,
        cbtCommission: 0n,
        escrowReleasedAt: null,
        service: {
          id: 'platform-service',
          tenantId: null,
          slug: 'jamb-result',
          name: 'Jamb Result',
        },
        requester: {
          id: 'user-1',
          email: 'ada@example.com',
          wallet: {
            id: 'wallet-1',
            availableBalance: 500000n,
            escrowBalance: 0n,
          },
        },
        dispute: null,
        transactions: [],
      },
    ]);
    prisma.service.findMany.mockResolvedValue([
      {
        id: 'tenant-service',
        tenantId: 'tenant-1',
        slug: 'jamb-result',
        totalPrice: 300000n,
        providerCost: 100000n,
        platformFeePercent: 10,
        cbtCommission: 150000n,
        isActive: true,
        updatedAt: new Date('2026-05-01T09:00:00.000Z'),
      },
    ]);

    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          tenantId: 'tenant-1',
          orderNumber: 'ORD-1',
          status: OrderStatus.PENDING,
          totalAmount: 0n,
          platformFee: 0n,
          cbtCommission: 0n,
          serviceId: 'platform-service',
          requester: {
            id: 'user-1',
            wallet: {
              id: 'wallet-1',
              availableBalance: 500000n,
              escrowBalance: 0n,
            },
          },
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      wallet: {
        update: jest.fn().mockResolvedValue(undefined),
      },
      transaction: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const result = await service.applyAdminOrderPricingRemediation(
      'admin-1',
      { applyAllEligible: true },
      null,
    );

    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: {
        availableBalance: 200000n,
        escrowBalance: 300000n,
      },
    });
    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: TransactionType.ESCROW_LOCK,
        amount: 300000n,
        orderId: 'order-1',
        tenantId: 'tenant-1',
      }),
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: {
        serviceId: 'tenant-service',
        totalAmount: 300000n,
        platformFee: 25000n,
        cbtCommission: 150000n,
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        action: 'ORDER_PRICING_REMEDIATED',
        entityId: 'order-1',
      }),
    });
    expect(result.data.summary.appliedCount).toBe(1);
  });

  it('creates disputes with uploaded evidence file metadata and pauses release scheduling', async () => {
    const completedOrder = buildOrderDetailRecord({
      status: OrderStatus.COMPLETED,
      dispute: null,
      disputeWindowExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const disputedOrder = buildOrderDetailRecord({
      status: OrderStatus.DISPUTED,
      dispute: {
        id: 'dispute-1',
        status: DisputeStatus.OPEN,
        evidenceUrls: [
          {
            url: 'https://files.example/evidence-1.pdf',
            filename: 'evidence-1.pdf',
            publicId: 'evidence-public-id',
          },
        ],
      },
    });
    prisma.order.findFirst.mockResolvedValue(completedOrder);

    const tx = {
      dispute: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      order: {
        update: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn().mockResolvedValue(disputedOrder),
      },
      notification: {
        createMany: jest.fn().mockResolvedValue(undefined),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      uploadedOrderFile: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    ordersReleaseQueueService.removeScheduledReleaseForOrder.mockResolvedValue({
      removed: true,
    });

    const result = await service.createDispute(
      'user-1',
      'order-1',
      {
        reason: 'The uploaded result is missing the required corrections.',
        evidenceFiles: [
          {
            url: 'https://files.example/evidence-1.pdf',
            filename: 'evidence-1.pdf',
            publicId: 'evidence-public-id',
          },
        ],
      },
      'tenant-1',
    );

    expect(tx.dispute.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-1',
        status: DisputeStatus.OPEN,
        evidenceUrls: [
          {
            url: 'https://files.example/evidence-1.pdf',
            filename: 'evidence-1.pdf',
            publicId: 'evidence-public-id',
          },
        ],
      }),
    });
    expect(
      ordersReleaseQueueService.removeScheduledReleaseForOrder,
    ).toHaveBeenCalledWith('order-1');
    expect(result.data.dispute?.evidenceFiles).toEqual([
      {
        url: 'https://files.example/evidence-1.pdf',
        filename: 'evidence-1.pdf',
        publicId: 'evidence-public-id',
      },
    ]);
    expect(result.data.dispute?.evidenceUrls).toEqual([
      'https://files.example/evidence-1.pdf',
    ]);
  });

  it('cleans up uploaded requester files when order creation fails before persistence', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '+2348012345678',
      wallet: {
        id: 'wallet-1',
        availableBalance: 9000n,
        escrowBalance: 1000n,
      },
    });
    prisma.service.findFirst.mockResolvedValue({
      id: 'service-1',
      name: 'Identity Validation',
      slug: 'identity-validation',
      totalPrice: 5000n,
      providerCost: 3000n,
      platformFee: 1000n,
      platformFeePercent: 20,
      cbtCommission: 2000n,
      providerKey: null,
      deliveryMode: ServiceDeliveryMode.CBT_MANUAL,
      fulfillmentType: FulfillmentType.MANUAL,
      isActive: true,
      requiredFields: [],
      requiredDocuments: [{ name: 'idCard', label: 'ID Card', required: true }],
      category: {
        name: 'Identity',
        slug: 'identity-services',
      },
    });
    prisma.$transaction.mockImplementation(() => {
      throw new Error('database write failed');
    });
    prisma.uploadedOrderFile.findMany.mockResolvedValue([
      {
        id: 'upload-1',
        publicId: 'orders/requesters/user-1/id-card.pdf',
      },
    ]);
    prisma.uploadedOrderFile.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.createOrder(
        'user-1',
        {
          serviceId: 'service-1',
          submittedData: {},
          requesterDocuments: {
            idCard: {
              url: 'https://files.example/id-card.pdf',
              filename: 'id-card.pdf',
              publicId: 'orders/requesters/user-1/id-card.pdf',
            },
          },
        },
        'tenant-1',
      ),
    ).rejects.toThrow('database write failed');

    expect(storageService.deleteFile).toHaveBeenCalledWith(
      'orders/requesters/user-1/id-card.pdf',
    );
  });

  it('cleans up uploaded dispute evidence when dispute creation fails before persistence', async () => {
    const completedOrder = buildOrderDetailRecord({
      status: OrderStatus.COMPLETED,
      dispute: null,
      disputeWindowExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    prisma.order.findFirst.mockResolvedValue(completedOrder);
    prisma.$transaction.mockImplementation(() => {
      throw new Error('dispute write failed');
    });
    prisma.uploadedOrderFile.findMany.mockResolvedValue([
      {
        id: 'upload-1',
        publicId: 'orders/requesters/user-1/evidence-1.pdf',
      },
    ]);
    prisma.uploadedOrderFile.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.createDispute(
        'user-1',
        'order-1',
        {
          reason: 'The result still contains the original mismatch.',
          evidenceFiles: [
            {
              url: 'https://files.example/evidence-1.pdf',
              filename: 'evidence-1.pdf',
              publicId: 'orders/requesters/user-1/evidence-1.pdf',
            },
          ],
        },
        'tenant-1',
      ),
    ).rejects.toThrow('dispute write failed');

    expect(storageService.deleteFile).toHaveBeenCalledWith(
      'orders/requesters/user-1/evidence-1.pdf',
    );
  });

  it('completes a CBT job, uploads the result, and schedules release', async () => {
    prisma.user.findFirst.mockResolvedValue(
      buildApprovedCbtUser(['identity-services']),
    );
    prisma.order.findUnique.mockResolvedValueOnce({
      id: 'order-1',
      tenantId: 'tenant-1',
      assignedCbtId: 'cbt-1',
      status: OrderStatus.ASSIGNED,
      dispute: null,
    });
    storageService.uploadFile.mockResolvedValue({
      url: 'https://files.example/result.pdf',
      publicId: 'result-public-id',
    });

    const completedOrder = buildOrderDetailRecord({
      resultFileUrl: 'https://files.example/result.pdf',
      cbtNotes: 'Completed successfully',
    });
    const tx = {
      order: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(completedOrder),
      },
      dispute: {
        update: jest.fn().mockResolvedValue(undefined),
      },
      notification: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      uploadedOrderFile: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    ordersReleaseQueueService.scheduleReleaseForOrder.mockResolvedValue({
      scheduled: true,
    });

    const result = await service.completeCbtJob(
      'cbt-1',
      'order-1',
      {
        originalname: 'result.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('result-file'),
        size: 1024,
      },
      { cbtNotes: 'Completed successfully' },
      'tenant-1',
    );

    expect(storageService.uploadFile).toHaveBeenCalled();
    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'order-1',
          assignedCbtId: 'cbt-1',
          tenantId: 'tenant-1',
        }),
        data: expect.objectContaining({
          status: OrderStatus.COMPLETED,
          resultFileUrl: 'result-public-id',
          cbtNotes: 'Completed successfully',
          disputeWindowExpiresAt: expect.any(Date),
        }),
      }),
    );
    expect(
      ordersReleaseQueueService.scheduleReleaseForOrder,
    ).toHaveBeenCalledWith('order-1');
    expect(notificationsService.emitEventToUser).toHaveBeenCalledWith(
      'user-1',
      'order:completed',
      expect.objectContaining({
        orderId: 'order-1',
      }),
    );
    expect(result.message).toBe(
      'Result uploaded and job completed successfully.',
    );
  });

  it('requests a redo by clearing the delivered result and unscheduling release', async () => {
    const disputedOrder = buildOrderDetailRecord({
      status: OrderStatus.COMPLETED,
      dispute: {
        id: 'dispute-1',
        status: DisputeStatus.OPEN,
      },
    });
    const refreshedOrder = buildOrderDetailRecord({
      status: OrderStatus.IN_PROGRESS,
      resultFileUrl: null,
      resultUploadedAt: null,
      completedAt: null,
      disputeWindowExpiresAt: null,
      dispute: {
        id: 'dispute-1',
        status: DisputeStatus.REDO_REQUESTED,
        resolutionNote: 'Please correct the uploaded result.',
        redoDeadline: new Date('2026-05-02T10:00:00.000Z'),
      },
    });
    prisma.order.findFirst.mockResolvedValue(disputedOrder);

    const tx = {
      wallet: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
      },
      dispute: {
        update: jest.fn().mockResolvedValue(undefined),
      },
      order: {
        update: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn().mockResolvedValue(refreshedOrder),
      },
      notification: {
        createMany: jest.fn().mockResolvedValue(undefined),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    ordersReleaseQueueService.removeScheduledReleaseForOrder.mockResolvedValue({
      removed: true,
    });

    const result = await service.reviewDispute(
      'admin-1',
      'order-1',
      {
        action: 'REQUEST_REDO',
        resolutionNote: 'Please correct the uploaded result.',
      },
      'tenant-1',
    );

    expect(tx.dispute.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: 'order-1' },
        data: expect.objectContaining({
          status: DisputeStatus.REDO_REQUESTED,
          resolvedAt: null,
          redoDeadline: expect.any(Date),
        }),
      }),
    );
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: {
        status: OrderStatus.IN_PROGRESS,
        resultFileUrl: null,
        resultUploadedAt: null,
        completedAt: null,
        disputeWindowExpiresAt: null,
      },
    });
    expect(
      ordersReleaseQueueService.removeScheduledReleaseForOrder,
    ).toHaveBeenCalledWith('order-1');
    expect(result.message).toBe('Redo requested successfully.');
  });

  it('refunds locked escrow on requester-favor dispute resolution', async () => {
    const disputedOrder = buildOrderDetailRecord({
      status: OrderStatus.COMPLETED,
      escrowReleasedAt: null,
      dispute: {
        id: 'dispute-1',
        status: DisputeStatus.OPEN,
      },
    });
    const refreshedOrder = buildOrderDetailRecord({
      status: OrderStatus.REFUNDED,
      transactions: [
        {
          id: 'txn-refund',
          type: TransactionType.REFUND,
          status: TransactionStatus.SUCCESS,
          amount: 5000n,
          description: 'Dispute refund issued for ORD-1001',
          reference: 'refund-ref-1',
          createdAt: new Date('2026-05-01T11:00:00.000Z'),
        },
      ],
      dispute: {
        id: 'dispute-1',
        status: DisputeStatus.RESOLVED_FOR_REQUESTER,
        resolutionNote: 'The result did not match the request.',
        resolvedAt: new Date('2026-05-01T11:00:00.000Z'),
      },
    });
    prisma.order.findFirst.mockResolvedValue(disputedOrder);

    const tx = {
      wallet: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'wallet-1',
          availableBalance: 2000n,
          escrowBalance: 5000n,
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      transaction: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      dispute: {
        update: jest.fn().mockResolvedValue(undefined),
      },
      order: {
        update: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn().mockResolvedValue(refreshedOrder),
      },
      notification: {
        createMany: jest.fn().mockResolvedValue(undefined),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    ordersReleaseQueueService.removeScheduledReleaseForOrder.mockResolvedValue({
      removed: true,
    });

    const result = await service.reviewDispute(
      'admin-1',
      'order-1',
      {
        action: 'RESOLVED_FOR_REQUESTER',
        resolutionNote: 'The result did not match the request.',
      },
      'tenant-1',
    );

    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: {
        availableBalance: 7000n,
        escrowBalance: 0n,
      },
    });
    expect(tx.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: TransactionType.REFUND,
          status: TransactionStatus.SUCCESS,
          amount: 5000n,
        }),
      }),
    );
    expect(
      ordersReleaseQueueService.removeScheduledReleaseForOrder,
    ).toHaveBeenCalledWith('order-1');
    expect(result.message).toBe('Dispute resolved in favor of the requester.');
  });

  it('resolves a dispute for the CBT center and re-queues release handling', async () => {
    const disputedOrder = buildOrderDetailRecord({
      status: OrderStatus.DISPUTED,
      dispute: {
        id: 'dispute-1',
        status: DisputeStatus.UNDER_REVIEW,
      },
    });
    const refreshedOrder = buildOrderDetailRecord({
      status: OrderStatus.COMPLETED,
      dispute: {
        id: 'dispute-1',
        status: DisputeStatus.RESOLVED_FOR_CBT,
        resolutionNote: 'The submitted result matches the service request.',
        resolvedAt: new Date('2026-05-01T11:15:00.000Z'),
      },
    });
    prisma.order.findFirst.mockResolvedValue(disputedOrder);

    const tx = {
      wallet: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
      },
      dispute: {
        update: jest.fn().mockResolvedValue(undefined),
      },
      order: {
        update: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn().mockResolvedValue(refreshedOrder),
      },
      notification: {
        createMany: jest.fn().mockResolvedValue(undefined),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    ordersReleaseQueueService.scheduleReleaseForOrder.mockResolvedValue({
      scheduled: true,
    });

    const result = await service.reviewDispute(
      'admin-1',
      'order-1',
      {
        action: 'RESOLVED_FOR_CBT',
        resolutionNote: 'The submitted result matches the service request.',
      },
      'tenant-1',
    );

    expect(tx.dispute.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: 'order-1' },
        data: expect.objectContaining({
          status: DisputeStatus.RESOLVED_FOR_CBT,
          resolvedAt: expect.any(Date),
          resolvedById: 'admin-1',
        }),
      }),
    );
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: {
        status: OrderStatus.COMPLETED,
        resultFileUrl: 'https://files.example/result.pdf',
        resultUploadedAt: new Date('2026-05-01T10:00:00.000Z'),
        completedAt: new Date('2026-05-01T10:00:00.000Z'),
        disputeWindowExpiresAt: new Date('2026-05-01T12:00:00.000Z'),
      },
    });
    expect(
      ordersReleaseQueueService.scheduleReleaseForOrder,
    ).toHaveBeenCalledWith('order-1');
    expect(result.message).toBe('Dispute resolved in favor of the CBT center.');
  });
});
