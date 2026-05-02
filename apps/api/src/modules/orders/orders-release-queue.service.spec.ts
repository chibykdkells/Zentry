import { OrderStatus, TransactionStatus, TransactionType, UserRole } from '@prisma/client';
import { OrdersReleaseQueueService } from './orders-release-queue.service';
import {
  buildReleaseEscrowJobId,
  RELEASE_ESCROW_JOB_NAME,
} from './release-queue.constants';

describe('OrdersReleaseQueueService', () => {
  let prisma: {
    order: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let releaseQueue: {
    add: jest.Mock;
    getJob: jest.Mock;
  };
  let notificationsService: {
    broadcastWalletUpdated: jest.Mock;
  };
  let service: OrdersReleaseQueueService;

  beforeEach(() => {
    prisma = {
      order: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    releaseQueue = {
      add: jest.fn(),
      getJob: jest.fn(),
    };

    notificationsService = {
      broadcastWalletUpdated: jest.fn(),
    };

    service = new OrdersReleaseQueueService(
      prisma as never,
      releaseQueue as never,
      notificationsService as never,
    );
  });

  it('queues delayed escrow release for eligible completed manual orders', async () => {
    const disputeWindowExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'ORD-1001',
      status: OrderStatus.COMPLETED,
      fulfillmentType: 'MANUAL',
      disputeWindowExpiresAt,
      escrowReleasedAt: null,
      assignedCbtId: 'cbt-1',
      dispute: null,
    });
    releaseQueue.add.mockResolvedValue(undefined);

    const result = await service.scheduleReleaseForOrder('order-1');

    expect(releaseQueue.add).toHaveBeenCalledWith(
      RELEASE_ESCROW_JOB_NAME,
      {
        orderId: 'order-1',
        orderNumber: 'ORD-1001',
      },
      expect.objectContaining({
        jobId: buildReleaseEscrowJobId('order-1'),
        attempts: 3,
        delay: expect.any(Number),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        scheduled: true,
        scheduledFor: disputeWindowExpiresAt,
        jobId: buildReleaseEscrowJobId('order-1'),
      }),
    );
  });

  it('releases escrow into requester, CBT, and platform ledgers after the dispute window', async () => {
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          orderNumber: 'ORD-1001',
          status: OrderStatus.COMPLETED,
          fulfillmentType: 'MANUAL',
          totalAmount: 5000n,
          platformFee: 1000n,
          cbtCommission: 2000n,
          escrowReleasedAt: null,
          disputeWindowExpiresAt: new Date(Date.now() - 5 * 60 * 1000),
          assignedCbtId: 'cbt-1',
          assignedCbt: {
            id: 'cbt-1',
            firstName: 'Prime',
            lastName: 'Center',
            email: 'cbt@example.com',
            role: UserRole.CBT_CENTER,
            cbtStaffProfile: null,
            wallet: {
              id: 'wallet-cbt',
              availableBalance: 3000n,
              totalEarned: 8000n,
            },
          },
          requester: {
            id: 'user-1',
            email: 'ada@example.com',
            wallet: {
              id: 'wallet-user',
              escrowBalance: 5000n,
            },
          },
          dispute: null,
          service: {
            id: 'service-1',
            name: 'Identity Validation',
            slug: 'identity-validation',
          },
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      wallet: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({
          id: 'wallet-platform',
          userId: 'admin-1',
          availableBalance: 12000n,
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      transaction: {
        createMany: jest.fn().mockResolvedValue(undefined),
      },
      notification: {
        createMany: jest.fn().mockResolvedValue(undefined),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );

    const result = await service.processReleaseEscrow('order-1');

    expect(tx.wallet.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'wallet-user' },
      data: {
        escrowBalance: 0n,
      },
    });
    expect(tx.wallet.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'wallet-cbt' },
      data: {
        availableBalance: 5000n,
        totalEarned: 10000n,
      },
    });
    expect(tx.wallet.update).toHaveBeenNthCalledWith(3, {
      where: { id: 'wallet-platform' },
      data: {
        availableBalance: 15000n,
      },
    });
    expect(tx.transaction.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            type: TransactionType.ESCROW_RELEASE,
            status: TransactionStatus.SUCCESS,
            amount: 5000n,
            userId: 'user-1',
          }),
          expect.objectContaining({
            type: TransactionType.CBT_COMMISSION,
            status: TransactionStatus.SUCCESS,
            amount: 2000n,
            userId: 'cbt-1',
          }),
          expect.objectContaining({
            type: TransactionType.PLATFORM_COMMISSION,
            status: TransactionStatus.SUCCESS,
            amount: 3000n,
            userId: 'admin-1',
          }),
        ]),
      }),
    );
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: {
        escrowReleasedAt: expect.any(Date),
      },
    });
    expect(notificationsService.broadcastWalletUpdated).toHaveBeenCalledWith(
      'cbt-1',
    );
    expect(result).toEqual(
      expect.objectContaining({
        released: true,
        skipped: false,
        orderNumber: 'ORD-1001',
        cbtCommission: '2000',
        platformNet: '3000',
        cbtId: 'cbt-1',
      }),
    );
  });
});
