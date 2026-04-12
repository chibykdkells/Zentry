import {
  BadRequestException,
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CbtApprovalStatus,
  FulfillmentType,
  NotificationType,
  OrderStatus,
  PaymentGateway,
  Prisma,
  TransactionStatus,
  TransactionType,
  UserRole,
  WithdrawalStatus,
} from '@prisma/client';
import type { Request } from 'express';
import { PaymentService } from '../../providers/payment/payment.service';
import { EmailService } from '../../providers/email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { generateTransactionRef } from '@zentry/utils';
import { nairaToKobo } from '@zentry/utils';
import { PrismaService } from '../prisma/prisma.service';
import {
  GetAdminWalletsQueryDto,
  GetAdminWithdrawalsQueryDto,
  GetAdminWalletTransactionsQueryDto,
  GetCbtEarningsQueryDto,
  GetMyWithdrawalsQueryDto,
  GetWalletTransactionsQueryDto,
  InitiateWalletFundingDto,
  CreateWithdrawalRequestDto,
  ReviewWithdrawalRequestDto,
} from './dto';

type WalletWithRecentTransactions = Prisma.WalletGetPayload<{
  select: {
    id: true;
    availableBalance: true;
    escrowBalance: true;
    totalEarned: true;
    totalWithdrawn: true;
    updatedAt: true;
    transactions: {
      orderBy: { createdAt: 'desc' };
      take: 5;
      select: {
        id: true;
        type: true;
        status: true;
        amount: true;
        balanceBefore: true;
        balanceAfter: true;
        reference: true;
        gatewayRef: true;
        gateway: true;
        description: true;
        createdAt: true;
      };
    };
  };
}>;

type WalletTransactionRecord = Prisma.TransactionGetPayload<{
  select: {
    id: true;
    type: true;
    status: true;
    amount: true;
    balanceBefore: true;
    balanceAfter: true;
    reference: true;
    gatewayRef: true;
    gateway: true;
    description: true;
    createdAt: true;
  };
}>;

type CbtCommissionTransactionRecord = Prisma.TransactionGetPayload<{
  select: {
    id: true;
    type: true;
    status: true;
    amount: true;
    balanceBefore: true;
    balanceAfter: true;
    reference: true;
    gatewayRef: true;
    gateway: true;
    description: true;
    createdAt: true;
    order: {
      select: {
        id: true;
        orderNumber: true;
        escrowReleasedAt: true;
        service: {
          select: {
            id: true;
            name: true;
            slug: true;
            category: {
              select: {
                id: true;
                name: true;
                slug: true;
              };
            };
          };
        };
        requester: {
          select: {
            id: true;
            firstName: true;
            lastName: true;
            email: true;
          };
        };
      };
    };
  };
}>;

type AdminRecentCbtCommissionRecord = Prisma.TransactionGetPayload<{
  select: {
    id: true;
    amount: true;
    reference: true;
    createdAt: true;
    user: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        email: true;
      };
    };
    order: {
      select: {
        id: true;
        orderNumber: true;
        service: {
          select: {
            id: true;
            name: true;
            slug: true;
            category: {
              select: {
                id: true;
                name: true;
                slug: true;
              };
            };
          };
        };
      };
    };
  };
}>;

type FundingTransactionRecord = Prisma.TransactionGetPayload<{
  select: {
    id: true;
    walletId: true;
    userId: true;
    type: true;
    status: true;
    amount: true;
    reference: true;
    gateway: true;
    gatewayRef: true;
    metadata: true;
    wallet: {
      select: {
        id: true;
        availableBalance: true;
      };
    };
  };
}>;

type WithdrawalRequestRecord = Prisma.WithdrawalRequestGetPayload<{
  select: {
    id: true;
    amount: true;
    bankName: true;
    bankCode: true;
    accountNumber: true;
    accountName: true;
    status: true;
    processorNote: true;
    gatewayRef: true;
    processedAt: true;
    createdAt: true;
    updatedAt: true;
    user: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        email: true;
      };
    };
  };
}>;

type AdminWithdrawalRequestRecord = Prisma.WithdrawalRequestGetPayload<{
  select: {
    id: true;
    amount: true;
    bankName: true;
    bankCode: true;
    accountNumber: true;
    accountName: true;
    status: true;
    processorNote: true;
    gatewayRef: true;
    processedAt: true;
    createdAt: true;
    updatedAt: true;
    user: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        email: true;
      };
    };
  };
}>;

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
  ) {}

  private async sendEmailSafely(input: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }) {
    await this.emailService.sendEmail(input).catch(() => undefined);
  }

  async getMyWalletOverview(userId: string, tenantId: string | null) {
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        userId,
        user: {
          ...(tenantId ? { tenantId } : { tenantId: null }),
        },
      },
      select: {
        id: true,
        availableBalance: true,
        escrowBalance: true,
        totalEarned: true,
        totalWithdrawn: true,
        updatedAt: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            type: true,
            status: true,
            amount: true,
            balanceBefore: true,
            balanceAfter: true,
            reference: true,
            gatewayRef: true,
            gateway: true,
            description: true,
            createdAt: true,
          },
        },
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const transactionCount = await this.prisma.transaction.count({
      where: { walletId: wallet.id },
    });

    return {
      message: 'Wallet overview retrieved',
      data: {
        ...this.serializeWallet(wallet),
        transactionCount,
      },
    };
  }

  async getAdminWalletOverview(tenantId: string | null) {
    const tf = tenantId ? { tenantId } : {};
    const walletTf = tenantId ? { user: { tenantId } } : {};
    const [
      walletAggregate,
      walletCount,
      fundedWalletCount,
      pendingFundingCount,
      successfulFundingAggregate,
      platformCommissionAggregate,
      cbtCommissionAggregate,
      withdrawalAggregate,
      refundAggregate,
      heldFundsByTenant,
    ] = await this.prisma.$transaction([
      this.prisma.wallet.aggregate({
        where: walletTf,
        _sum: {
          availableBalance: true,
          escrowBalance: true,
          totalEarned: true,
          totalWithdrawn: true,
        },
      }),
      this.prisma.wallet.count({ where: walletTf }),
      this.prisma.wallet.count({
        where: {
          ...walletTf,
          OR: [
            { availableBalance: { gt: 0n } },
            { escrowBalance: { gt: 0n } },
            { totalEarned: { gt: 0n } },
          ],
        },
      }),
      this.prisma.transaction.count({
        where: {
          ...tf,
          type: TransactionType.WALLET_FUNDING,
          status: TransactionStatus.PENDING,
        },
      }),
      this.prisma.transaction.aggregate({
        where: {
          ...tf,
          type: TransactionType.WALLET_FUNDING,
          status: TransactionStatus.SUCCESS,
        },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.transaction.aggregate({
        where: {
          ...tf,
          type: TransactionType.PLATFORM_COMMISSION,
          status: TransactionStatus.SUCCESS,
        },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.transaction.aggregate({
        where: {
          ...tf,
          type: TransactionType.CBT_COMMISSION,
          status: TransactionStatus.SUCCESS,
        },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.transaction.aggregate({
        where: {
          ...tf,
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.SUCCESS,
        },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.transaction.aggregate({
        where: {
          ...tf,
          type: TransactionType.REFUND,
          status: TransactionStatus.SUCCESS,
        },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.tenant.findMany({
        where: tenantId ? { id: tenantId } : undefined,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          users: {
            select: {
              wallet: {
                select: {
                  escrowBalance: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const heldFundsByBusiness = heldFundsByTenant
      .map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        heldFunds: tenant.users
          .reduce((sum, user) => sum + (user.wallet?.escrowBalance ?? 0n), 0n)
          .toString(),
      }))
      .filter((tenant) => tenant.heldFunds !== '0')
      .sort((left, right) => {
        const leftAmount = BigInt(left.heldFunds);
        const rightAmount = BigInt(right.heldFunds);

        if (leftAmount === rightAmount) {
          return left.name.localeCompare(right.name);
        }

        return rightAmount > leftAmount ? 1 : -1;
      });

    return {
      message: 'Admin wallet overview retrieved',
      data: {
        totalWallets: walletCount,
        fundedWallets: fundedWalletCount,
        pendingFundingCount,
        totalAvailableBalance:
          walletAggregate._sum.availableBalance?.toString() ?? '0',
        totalEscrowBalance:
          walletAggregate._sum.escrowBalance?.toString() ?? '0',
        totalEarned: walletAggregate._sum.totalEarned?.toString() ?? '0',
        totalWithdrawn: walletAggregate._sum.totalWithdrawn?.toString() ?? '0',
        successfulFundingVolume:
          successfulFundingAggregate._sum.amount?.toString() ?? '0',
        commissionVolume: (
          (platformCommissionAggregate._sum.amount ?? 0n) +
          (cbtCommissionAggregate._sum.amount ?? 0n)
        ).toString(),
        platformCommissionVolume:
          platformCommissionAggregate._sum.amount?.toString() ?? '0',
        cbtCommissionVolume:
          cbtCommissionAggregate._sum.amount?.toString() ?? '0',
        withdrawalVolume: withdrawalAggregate._sum.amount?.toString() ?? '0',
        refundVolume: refundAggregate._sum.amount?.toString() ?? '0',
        heldFundsByTenant: heldFundsByBusiness,
      },
    };
  }

  async getAdminCbtEarningsOverview(tenantId: string | null) {
    const now = new Date();
    const tf = tenantId ? { tenantId } : {};
    const releasedCommissionWhere: Prisma.TransactionWhereInput = {
      ...tf,
      type: TransactionType.CBT_COMMISSION,
      status: TransactionStatus.SUCCESS,
      user: {
        role: UserRole.CBT_CENTER,
      },
      order: {
        is: {
          escrowReleasedAt: {
            not: null,
          },
        },
      },
    };

    const awaitingReleaseWhere: Prisma.OrderWhereInput = {
      ...tf,
      fulfillmentType: FulfillmentType.MANUAL,
      status: OrderStatus.COMPLETED,
      assignedCbtId: {
        not: null,
      },
      escrowReleasedAt: null,
      dispute: null,
      disputeWindowExpiresAt: {
        gt: now,
      },
    };

    const readyReleaseWhere: Prisma.OrderWhereInput = {
      ...tf,
      fulfillmentType: FulfillmentType.MANUAL,
      status: OrderStatus.COMPLETED,
      assignedCbtId: {
        not: null,
      },
      escrowReleasedAt: null,
      dispute: null,
      disputeWindowExpiresAt: {
        lte: now,
      },
    };

    const blockedReleaseWhere: Prisma.OrderWhereInput = {
      ...tf,
      fulfillmentType: FulfillmentType.MANUAL,
      status: OrderStatus.COMPLETED,
      assignedCbtId: {
        not: null,
      },
      escrowReleasedAt: null,
      dispute: {
        isNot: null,
      },
    };

    const [
      releasedCommissionAggregate,
      releasedCommissionCount,
      awaitingOrders,
      readyOrders,
      blockedOrders,
      cbtWalletAggregate,
      topCbtWallets,
      recentReleased,
    ] = await this.prisma.$transaction([
      this.prisma.transaction.aggregate({
        where: releasedCommissionWhere,
        _sum: {
          amount: true,
        },
      }),
      this.prisma.transaction.count({
        where: releasedCommissionWhere,
      }),
      this.prisma.order.findMany({
        where: awaitingReleaseWhere,
        select: {
          id: true,
          orderNumber: true,
          cbtCommission: true,
          disputeWindowExpiresAt: true,
          assignedCbt: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: { disputeWindowExpiresAt: 'asc' },
        take: 5,
      }),
      this.prisma.order.findMany({
        where: readyReleaseWhere,
        select: {
          id: true,
          orderNumber: true,
          cbtCommission: true,
          disputeWindowExpiresAt: true,
          assignedCbt: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: { disputeWindowExpiresAt: 'asc' },
        take: 5,
      }),
      this.prisma.order.findMany({
        where: blockedReleaseWhere,
        select: {
          id: true,
          orderNumber: true,
          cbtCommission: true,
          disputeWindowExpiresAt: true,
          assignedCbt: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          dispute: {
            select: {
              id: true,
              status: true,
              reason: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      this.prisma.wallet.aggregate({
        where: {
          user: {
            role: UserRole.CBT_CENTER,
            ...(tenantId ? { tenantId } : {}),
          },
        },
        _sum: {
          availableBalance: true,
          totalEarned: true,
          totalWithdrawn: true,
        },
      }),
      this.prisma.wallet.findMany({
        where: {
          user: {
            role: UserRole.CBT_CENTER,
            ...(tenantId ? { tenantId } : {}),
          },
        },
        orderBy: [{ totalEarned: 'desc' }, { availableBalance: 'desc' }],
        take: 5,
        select: {
          id: true,
          availableBalance: true,
          totalEarned: true,
          totalWithdrawn: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              isActive: true,
            },
          },
        },
      }),
      this.prisma.transaction.findMany({
        where: releasedCommissionWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          amount: true,
          reference: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              service: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  category: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const awaitingReleaseAmount = awaitingOrders.reduce(
      (sum, order) => sum + order.cbtCommission,
      0n,
    );
    const readyReleaseAmount = readyOrders.reduce(
      (sum, order) => sum + order.cbtCommission,
      0n,
    );
    const blockedReleaseAmount = blockedOrders.reduce(
      (sum, order) => sum + order.cbtCommission,
      0n,
    );

    return {
      message: 'Admin CBT earnings overview retrieved',
      data: {
        summary: {
          releasedCommissionVolume:
            releasedCommissionAggregate._sum.amount?.toString() ?? '0',
          releasedCommissionCount,
          totalCbtWithdrawableBalance:
            cbtWalletAggregate._sum.availableBalance?.toString() ?? '0',
          totalCbtEarned:
            cbtWalletAggregate._sum.totalEarned?.toString() ?? '0',
          totalCbtWithdrawn:
            cbtWalletAggregate._sum.totalWithdrawn?.toString() ?? '0',
          awaitingReleaseAmount: awaitingReleaseAmount.toString(),
          awaitingReleaseCount: awaitingOrders.length,
          readyReleaseAmount: readyReleaseAmount.toString(),
          readyReleaseCount: readyOrders.length,
          blockedReleaseAmount: blockedReleaseAmount.toString(),
          blockedReleaseCount: blockedOrders.length,
        },
        queue: {
          awaiting: awaitingOrders.map((order) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            amount: order.cbtCommission.toString(),
            disputeWindowExpiresAt: order.disputeWindowExpiresAt,
            cbt: order.assignedCbt,
            service: order.service,
          })),
          ready: readyOrders.map((order) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            amount: order.cbtCommission.toString(),
            disputeWindowExpiresAt: order.disputeWindowExpiresAt,
            cbt: order.assignedCbt,
            service: order.service,
          })),
          blocked: blockedOrders.map((order) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            amount: order.cbtCommission.toString(),
            disputeWindowExpiresAt: order.disputeWindowExpiresAt,
            cbt: order.assignedCbt,
            service: order.service,
            dispute: order.dispute,
          })),
        },
        topCbtWallets: topCbtWallets.map((wallet) => ({
          id: wallet.id,
          availableBalance: wallet.availableBalance.toString(),
          totalEarned: wallet.totalEarned.toString(),
          totalWithdrawn: wallet.totalWithdrawn.toString(),
          user: wallet.user,
        })),
        recentReleased: recentReleased.map((transaction) =>
          this.serializeAdminRecentCbtCommission(transaction),
        ),
      },
    };
  }

  async getAdminWithdrawals(
    query: GetAdminWithdrawalsQueryDto,
    tenantId: string | null,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const trimmedSearch = query.search?.trim();
    const effectiveTenantId = query.tenantId ?? tenantId;
    const tf = effectiveTenantId ? { tenantId: effectiveTenantId } : {};
    const where: Prisma.WithdrawalRequestWhereInput = {
      ...tf,
      ...(query.status ? { status: query.status } : {}),
      ...(trimmedSearch
        ? {
            user: {
              OR: [
                {
                  firstName: {
                    contains: trimmedSearch,
                    mode: 'insensitive',
                  },
                },
                {
                  lastName: {
                    contains: trimmedSearch,
                    mode: 'insensitive',
                  },
                },
                {
                  email: {
                    contains: trimmedSearch,
                    mode: 'insensitive',
                  },
                },
              ],
            },
          }
        : {}),
    };

    const [
      total,
      requests,
      pendingAggregate,
      approvedAggregate,
      processingAggregate,
      completedAggregate,
      rejectedAggregate,
    ] = await this.prisma.$transaction([
      this.prisma.withdrawalRequest.count({ where }),
      this.prisma.withdrawalRequest.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          amount: true,
          bankName: true,
          bankCode: true,
          accountNumber: true,
          accountName: true,
          status: true,
          processorNote: true,
          gatewayRef: true,
          processedAt: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.withdrawalRequest.aggregate({
        where: { ...tf, status: WithdrawalStatus.PENDING },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.withdrawalRequest.aggregate({
        where: { ...tf, status: WithdrawalStatus.APPROVED },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.withdrawalRequest.aggregate({
        where: { ...tf, status: WithdrawalStatus.PROCESSING },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.withdrawalRequest.aggregate({
        where: { ...tf, status: WithdrawalStatus.COMPLETED },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.withdrawalRequest.aggregate({
        where: { ...tf, status: WithdrawalStatus.REJECTED },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      message: 'Admin withdrawal requests retrieved',
      data: {
        items: requests.map((request) =>
          this.serializeAdminWithdrawalRequest(request),
        ),
        summary: {
          pendingAmount: pendingAggregate._sum.amount?.toString() ?? '0',
          pendingCount: pendingAggregate._count ?? 0,
          approvedAmount: approvedAggregate._sum.amount?.toString() ?? '0',
          approvedCount: approvedAggregate._count ?? 0,
          processingAmount: processingAggregate._sum.amount?.toString() ?? '0',
          processingCount: processingAggregate._count ?? 0,
          completedAmount: completedAggregate._sum.amount?.toString() ?? '0',
          completedCount: completedAggregate._count ?? 0,
          rejectedAmount: rejectedAggregate._sum.amount?.toString() ?? '0',
          rejectedCount: rejectedAggregate._count ?? 0,
        },
        meta: {
          page,
          limit,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / limit),
          hasNextPage: page * limit < total,
        },
        filters: {
          status: query.status ?? null,
          tenantId: query.tenantId ?? null,
          search: trimmedSearch ?? null,
        },
      },
    };
  }

  async getMyWithdrawals(
    userId: string,
    query: GetMyWithdrawalsQueryDto,
    tenantId: string | null,
  ) {
    await this.ensureWithdrawalEligibleUser(userId, tenantId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.WithdrawalRequestWhereInput = {
      userId,
      ...(tenantId ? { tenantId } : { tenantId: null }),
      ...(query.status ? { status: query.status } : {}),
    };

    const [
      total,
      requests,
      pendingAggregate,
      approvedAggregate,
      processingAggregate,
      completedAggregate,
      rejectedAggregate,
    ] = await this.prisma.$transaction([
      this.prisma.withdrawalRequest.count({ where }),
      this.prisma.withdrawalRequest.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          amount: true,
          bankName: true,
          bankCode: true,
          accountNumber: true,
          accountName: true,
          status: true,
          processorNote: true,
          gatewayRef: true,
          processedAt: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.withdrawalRequest.aggregate({
        where: {
          userId,
          ...(tenantId ? { tenantId } : { tenantId: null }),
          status: WithdrawalStatus.PENDING,
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.withdrawalRequest.aggregate({
        where: {
          userId,
          ...(tenantId ? { tenantId } : { tenantId: null }),
          status: WithdrawalStatus.APPROVED,
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.withdrawalRequest.aggregate({
        where: {
          userId,
          ...(tenantId ? { tenantId } : { tenantId: null }),
          status: WithdrawalStatus.PROCESSING,
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.withdrawalRequest.aggregate({
        where: {
          userId,
          ...(tenantId ? { tenantId } : { tenantId: null }),
          status: WithdrawalStatus.COMPLETED,
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.withdrawalRequest.aggregate({
        where: {
          userId,
          ...(tenantId ? { tenantId } : { tenantId: null }),
          status: WithdrawalStatus.REJECTED,
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      message: 'Withdrawal requests retrieved',
      data: {
        items: requests.map((request) =>
          this.serializeWithdrawalRequest(request),
        ),
        summary: {
          pendingAmount: pendingAggregate._sum.amount?.toString() ?? '0',
          pendingCount: pendingAggregate._count ?? 0,
          approvedAmount: approvedAggregate._sum.amount?.toString() ?? '0',
          approvedCount: approvedAggregate._count ?? 0,
          processingAmount: processingAggregate._sum.amount?.toString() ?? '0',
          processingCount: processingAggregate._count ?? 0,
          completedAmount: completedAggregate._sum.amount?.toString() ?? '0',
          completedCount: completedAggregate._count ?? 0,
          rejectedAmount: rejectedAggregate._sum.amount?.toString() ?? '0',
          rejectedCount: rejectedAggregate._count ?? 0,
        },
        meta: {
          page,
          limit,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / limit),
          hasNextPage: page * limit < total,
        },
        filters: {
          status: query.status ?? null,
        },
      },
    };
  }

  async createWithdrawalRequest(
    userId: string,
    dto: CreateWithdrawalRequestDto,
    tenantId: string | null,
  ) {
    await this.ensureWithdrawalEligibleUser(userId, tenantId);

    const amount = nairaToKobo(dto.amountNaira);
    if (amount <= 0n) {
      throw new BadRequestException('Enter a valid withdrawal amount.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findFirst({
        where: {
          userId,
          user: {
            ...(tenantId ? { tenantId } : { tenantId: null }),
          },
        },
        select: {
          id: true,
          availableBalance: true,
          totalWithdrawn: true,
        },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      if (wallet.availableBalance < amount) {
        throw new BadRequestException(
          'You do not have enough withdrawable balance for this request.',
        );
      }

      const request = await tx.withdrawalRequest.create({
        data: {
          userId,
          tenantId,
          amount,
          bankName: dto.bankName.trim(),
          bankCode: dto.bankCode.trim(),
          accountNumber: dto.accountNumber.trim(),
          accountName: dto.accountName.trim(),
          status: WithdrawalStatus.PENDING,
        },
        select: {
          id: true,
          amount: true,
          bankName: true,
          bankCode: true,
          accountNumber: true,
          accountName: true,
          status: true,
          processorNote: true,
          gatewayRef: true,
          processedAt: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      const balanceBefore = wallet.availableBalance;
      const balanceAfter = balanceBefore - amount;
      const reference = generateTransactionRef();

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: balanceAfter,
        },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.PENDING,
          amount,
          balanceBefore,
          balanceAfter,
          reference,
          description: 'Withdrawal request submitted',
          metadata: {
            withdrawalRequestId: request.id,
            withdrawalStatus: WithdrawalStatus.PENDING,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'WITHDRAWAL_REQUEST_SUBMITTED',
          entity: 'WithdrawalRequest',
          entityId: request.id,
          newValues: {
            amount: amount.toString(),
            bankName: request.bankName,
            accountNumber: this.maskAccountNumber(request.accountNumber),
            status: request.status,
          },
        },
      });

      return {
        request,
        wallet: {
          availableBalance: balanceAfter.toString(),
          totalWithdrawn: wallet.totalWithdrawn.toString(),
        },
      };
    });

    return {
      message: 'Withdrawal request submitted.',
      data: {
        request: this.serializeWithdrawalRequest(result.request),
        wallet: result.wallet,
      },
    };
  }

  async reviewWithdrawalRequest(
    adminUserId: string,
    withdrawalRequestId: string,
    dto: ReviewWithdrawalRequestDto,
    tenantId: string | null = null,
  ) {
    if (dto.status === WithdrawalStatus.PENDING) {
      throw new BadRequestException('Pending is not a review action.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const request = await tx.withdrawalRequest.findFirst({
        where: {
          id: withdrawalRequestId,
          ...(tenantId ? { tenantId } : {}),
        },
        select: {
          id: true,
          userId: true,
          amount: true,
          bankName: true,
          bankCode: true,
          accountNumber: true,
          accountName: true,
          status: true,
          processorNote: true,
          gatewayRef: true,
          processedAt: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      if (!request) {
        throw new NotFoundException('Withdrawal request not found.');
      }

      this.assertWithdrawalTransition(request.status, dto.status);

      const wallet = await tx.wallet.findUnique({
        where: { userId: request.userId },
        select: {
          id: true,
          availableBalance: true,
          totalWithdrawn: true,
        },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found.');
      }

      const pendingWithdrawalTransaction = await tx.transaction.findFirst({
        where: {
          walletId: wallet.id,
          userId: request.userId,
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.PENDING,
          metadata: {
            path: ['withdrawalRequestId'],
            equals: request.id,
          },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          reference: true,
          amount: true,
          metadata: true,
        },
      });

      if (
        !pendingWithdrawalTransaction &&
        dto.status !== WithdrawalStatus.REJECTED
      ) {
        throw new NotFoundException(
          'Pending withdrawal ledger entry not found for this request.',
        );
      }

      const trimmedNote = dto.note?.trim() || null;
      const trimmedGatewayRef = dto.gatewayRef?.trim() || null;

      let updatedRequest: WithdrawalRequestRecord;

      if (dto.status === WithdrawalStatus.REJECTED) {
        const balanceBefore = wallet.availableBalance;
        const balanceAfter = balanceBefore + request.amount;

        if (pendingWithdrawalTransaction) {
          await tx.transaction.update({
            where: { id: pendingWithdrawalTransaction.id },
            data: {
              status: TransactionStatus.REVERSED,
              metadata: {
                ...this.toMetadataRecord(pendingWithdrawalTransaction.metadata),
                withdrawalStatus: WithdrawalStatus.REJECTED,
              },
            },
          });
        }

        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            availableBalance: balanceAfter,
          },
        });

        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            userId: request.userId,
            type: TransactionType.WITHDRAWAL,
            status: TransactionStatus.REVERSED,
            amount: request.amount,
            balanceBefore,
            balanceAfter,
            reference: generateTransactionRef(),
            description: 'Withdrawal request rejected and funds restored',
            metadata: {
              withdrawalRequestId: request.id,
              reversalOfReference:
                pendingWithdrawalTransaction?.reference ?? null,
            },
          },
        });

        updatedRequest = await tx.withdrawalRequest.update({
          where: { id: request.id },
          data: {
            status: WithdrawalStatus.REJECTED,
            processedById: adminUserId,
            processorNote: trimmedNote,
            processedAt: new Date(),
          },
          select: {
            id: true,
            amount: true,
            bankName: true,
            bankCode: true,
            accountNumber: true,
            accountName: true,
            status: true,
            processorNote: true,
            gatewayRef: true,
            processedAt: true,
            createdAt: true,
            updatedAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });

        await tx.notification.create({
          data: {
            userId: request.userId,
            type: NotificationType.WITHDRAWAL_REJECTED,
            title: 'Withdrawal request rejected',
            message:
              trimmedNote ??
              'Your withdrawal request was rejected and the funds were restored to your wallet.',
            metadata: {
              withdrawalRequestId: request.id,
              amount: request.amount.toString(),
            },
          },
        });
      } else {
        if (pendingWithdrawalTransaction) {
          await tx.transaction.update({
            where: { id: pendingWithdrawalTransaction.id },
            data: {
              ...(dto.status === WithdrawalStatus.COMPLETED
                ? { status: TransactionStatus.SUCCESS }
                : {}),
              ...(trimmedGatewayRef ? { gatewayRef: trimmedGatewayRef } : {}),
              metadata: {
                ...this.toMetadataRecord(pendingWithdrawalTransaction.metadata),
                withdrawalStatus: dto.status,
              },
            },
          });
        }

        const shouldMarkProcessed = dto.status === WithdrawalStatus.COMPLETED;

        if (dto.status === WithdrawalStatus.COMPLETED) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              totalWithdrawn: {
                increment: request.amount,
              },
            },
          });
        }

        updatedRequest = await tx.withdrawalRequest.update({
          where: { id: request.id },
          data: {
            status: dto.status,
            processedById: adminUserId,
            processorNote: trimmedNote,
            gatewayRef: trimmedGatewayRef,
            processedAt: shouldMarkProcessed ? new Date() : null,
          },
          select: {
            id: true,
            amount: true,
            bankName: true,
            bankCode: true,
            accountNumber: true,
            accountName: true,
            status: true,
            processorNote: true,
            gatewayRef: true,
            processedAt: true,
            createdAt: true,
            updatedAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });

        if (dto.status === WithdrawalStatus.APPROVED) {
          await tx.notification.create({
            data: {
              userId: request.userId,
              type: NotificationType.WITHDRAWAL_APPROVED,
              title: 'Withdrawal request approved',
              message:
                trimmedNote ??
                'Your withdrawal request has been approved and moved into payout review.',
              metadata: {
                withdrawalRequestId: request.id,
                amount: request.amount.toString(),
              },
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'WITHDRAWAL_REQUEST_REVIEWED',
          entity: 'WithdrawalRequest',
          entityId: request.id,
          oldValues: {
            status: request.status,
          },
          newValues: {
            status: dto.status,
            amount: request.amount.toString(),
            note: trimmedNote,
            gatewayRef: trimmedGatewayRef,
          },
        },
      });

      return updatedRequest;
    });

    // Real-time: notify user of withdrawal decision
    this.notificationsService.pushNotificationToUser(result.user.id, {
      type:
        dto.status === WithdrawalStatus.REJECTED
          ? 'WITHDRAWAL_REJECTED'
          : 'WITHDRAWAL_APPROVED',
      title:
        dto.status === WithdrawalStatus.REJECTED
          ? 'Withdrawal request rejected'
          : 'Withdrawal request approved',
      message:
        dto.status === WithdrawalStatus.REJECTED
          ? 'Your withdrawal request was rejected and the funds were restored to your wallet.'
          : 'Your withdrawal request has been approved and moved into payout review.',
    });
    await this.sendEmailSafely({
      to: result.user.email,
      subject:
        dto.status === WithdrawalStatus.REJECTED
          ? 'Withdrawal request update'
          : 'Withdrawal request approved',
      text: [
        `Hi ${result.user.firstName || 'there'},`,
        '',
        dto.status === WithdrawalStatus.REJECTED
          ? 'Your withdrawal request was rejected and the funds were restored to your wallet.'
          : 'Your withdrawal request has been approved and moved into payout review.',
        `Request ID: ${result.id}`,
      ].join('\n'),
      html: `
        <p>Hi ${result.user.firstName || 'there'},</p>
        <p>${
          dto.status === WithdrawalStatus.REJECTED
            ? 'Your withdrawal request was rejected and the funds were restored to your wallet.'
            : 'Your withdrawal request has been approved and moved into payout review.'
        }</p>
        <p><strong>Request ID:</strong> ${result.id}</p>
      `,
    });

    // Auto-initiate bank transfer when admin approves
    if (dto.status === WithdrawalStatus.APPROVED) {
      const payoutRef = `ZEN-PAYOUT-${result.id.replace(/-/g, '').slice(0, 16).toUpperCase()}`;
      try {
        const transferResult = await this.paymentService.initiateTransfer({
          amountKobo: result.amount,
          accountNumber: result.accountNumber,
          bankCode: result.bankCode,
          accountName: result.accountName,
          reference: payoutRef,
          narration: `Zentry withdrawal ${result.id}`,
        });

        // Advance to PROCESSING and store the gateway reference
        await this.prisma.withdrawalRequest.update({
          where: { id: result.id },
          data: {
            status: WithdrawalStatus.PROCESSING,
            gatewayRef: transferResult.gatewayRef,
          },
        });

        if (transferResult.status === 'SUCCESS') {
          // Gateway settled immediately — mark COMPLETED
          await this.prisma.$transaction(async (tx) => {
            const wallet = await tx.wallet.findUnique({
              where: { userId: result.user.id },
              select: { id: true, totalWithdrawn: true },
            });
            if (wallet) {
              await tx.wallet.update({
                where: { id: wallet.id },
                data: { totalWithdrawn: { increment: result.amount } },
              });
            }
            await tx.withdrawalRequest.update({
              where: { id: result.id },
              data: {
                status: WithdrawalStatus.COMPLETED,
                processedAt: new Date(),
              },
            });
            await tx.transaction.updateMany({
              where: {
                userId: result.user.id,
                type: TransactionType.WITHDRAWAL,
                status: TransactionStatus.PENDING,
                metadata: { path: ['withdrawalRequestId'], equals: result.id },
              },
              data: {
                status: TransactionStatus.SUCCESS,
                gatewayRef: transferResult.gatewayRef,
              },
            });
          });
        }
      } catch (err) {
        // Payout initiation failed — keep status as APPROVED for manual retry
        this.logger.error(
          `Payout initiation failed for withdrawal ${result.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      message: this.getWithdrawalReviewMessage(dto.status),
      data: this.serializeWithdrawalRequest(result),
    };
  }

  async getAdminWallets(
    query: GetAdminWalletsQueryDto,
    tenantId: string | null,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const trimmedSearch = query.search?.trim();
    const userBase = {
      ...(query.role ? { role: query.role } : {}),
      ...((query.tenantId ?? tenantId)
        ? { tenantId: query.tenantId ?? tenantId }
        : {}),
    };
    const where: Prisma.WalletWhereInput = {
      ...(query.role || tenantId ? { user: userBase } : {}),
      ...(trimmedSearch
        ? {
            user: {
              ...userBase,
              OR: [
                {
                  firstName: {
                    contains: trimmedSearch,
                    mode: 'insensitive',
                  },
                },
                {
                  lastName: {
                    contains: trimmedSearch,
                    mode: 'insensitive',
                  },
                },
                {
                  email: {
                    contains: trimmedSearch,
                    mode: 'insensitive',
                  },
                },
              ],
            },
          }
        : {}),
    };

    const [total, wallets] = await this.prisma.$transaction([
      this.prisma.wallet.count({ where }),
      this.prisma.wallet.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          availableBalance: true,
          escrowBalance: true,
          totalEarned: true,
          totalWithdrawn: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
          _count: {
            select: {
              transactions: true,
            },
          },
        },
      }),
    ]);

    return {
      message: 'Admin wallet list retrieved',
      data: {
        items: wallets.map((wallet) => ({
          id: wallet.id,
          availableBalance: wallet.availableBalance.toString(),
          escrowBalance: wallet.escrowBalance.toString(),
          totalEarned: wallet.totalEarned.toString(),
          totalWithdrawn: wallet.totalWithdrawn.toString(),
          updatedAt: wallet.updatedAt,
          transactionCount: wallet._count.transactions,
          user: {
            id: wallet.user.id,
            firstName: wallet.user.firstName,
            lastName: wallet.user.lastName,
            email: wallet.user.email,
            role: wallet.user.role,
            isActive: wallet.user.isActive,
          },
        })),
        meta: {
          page,
          limit,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / limit),
          hasNextPage: page * limit < total,
        },
        filters: {
          role: query.role ?? null,
          tenantId: query.tenantId ?? null,
          search: trimmedSearch ?? null,
        },
      },
    };
  }

  async getAdminTransactions(
    query: GetAdminWalletTransactionsQueryDto,
    tenantId: string | null,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const trimmedSearch = query.search?.trim();
    const createdAtFilter = this.buildTransactionDateFilter(query);
    const userFilter = this.buildAdminUserFilter(
      query.role,
      trimmedSearch,
      query.tenantId ?? tenantId,
    );
    const where: Prisma.TransactionWhereInput = {
      ...((query.tenantId ?? tenantId)
        ? { tenantId: query.tenantId ?? tenantId }
        : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      ...(userFilter ? { user: userFilter } : {}),
      ...(trimmedSearch
        ? {
            OR: [
              {
                reference: {
                  contains: trimmedSearch,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: trimmedSearch,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [total, transactions] = await this.prisma.$transaction([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          status: true,
          amount: true,
          balanceBefore: true,
          balanceAfter: true,
          reference: true,
          gatewayRef: true,
          gateway: true,
          description: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return {
      message: 'Admin wallet transactions retrieved',
      data: {
        items: transactions.map((transaction) => ({
          ...this.serializeTransaction(transaction),
          user: {
            id: transaction.user.id,
            firstName: transaction.user.firstName,
            lastName: transaction.user.lastName,
            email: transaction.user.email,
            role: transaction.user.role,
          },
        })),
        meta: {
          page,
          limit,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / limit),
          hasNextPage: page * limit < total,
        },
        filters: {
          type: query.type ?? null,
          status: query.status ?? null,
          role: query.role ?? null,
          tenantId: query.tenantId ?? null,
          search: trimmedSearch ?? null,
          startDate: query.startDate ?? null,
          endDate: query.endDate ?? null,
        },
      },
    };
  }

  async getMyTransactions(
    userId: string,
    query: GetWalletTransactionsQueryDto,
    tenantId: string | null,
  ) {
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        userId,
        user: {
          ...(tenantId ? { tenantId } : { tenantId: null }),
        },
      },
      select: { id: true },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const createdAtFilter = this.buildTransactionDateFilter(query);
    const where: Prisma.TransactionWhereInput = {
      walletId: wallet.id,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    };

    const [total, transactions] = await this.prisma.$transaction([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          status: true,
          amount: true,
          balanceBefore: true,
          balanceAfter: true,
          reference: true,
          gatewayRef: true,
          gateway: true,
          description: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      message: 'Wallet transactions retrieved',
      data: {
        items: transactions.map((transaction) =>
          this.serializeTransaction(transaction),
        ),
        meta: {
          page,
          limit,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / limit),
          hasNextPage: page * limit < total,
        },
        filters: {
          type: query.type ?? null,
          status: query.status ?? null,
          startDate: query.startDate ?? null,
          endDate: query.endDate ?? null,
        },
      },
    };
  }

  async getCbtEarnings(
    userId: string,
    query: GetCbtEarningsQueryDto,
    tenantId: string | null,
  ) {
    await this.ensureApprovedCbtUser(userId, tenantId);

    const wallet = await this.prisma.wallet.findFirst({
      where: {
        userId,
        user: {
          ...(tenantId ? { tenantId } : { tenantId: null }),
        },
      },
      select: {
        id: true,
        availableBalance: true,
        totalEarned: true,
        totalWithdrawn: true,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const now = new Date();

    const awaitingReleaseWhere: Prisma.OrderWhereInput = {
      assignedCbtId: userId,
      ...(tenantId ? { tenantId } : {}),
      fulfillmentType: FulfillmentType.MANUAL,
      status: OrderStatus.COMPLETED,
      escrowReleasedAt: null,
      dispute: null,
      disputeWindowExpiresAt: {
        gt: now,
      },
    };

    const readyReleaseWhere: Prisma.OrderWhereInput = {
      assignedCbtId: userId,
      ...(tenantId ? { tenantId } : {}),
      fulfillmentType: FulfillmentType.MANUAL,
      status: OrderStatus.COMPLETED,
      escrowReleasedAt: null,
      dispute: null,
      disputeWindowExpiresAt: {
        lte: now,
      },
    };

    const blockedReleaseWhere: Prisma.OrderWhereInput = {
      assignedCbtId: userId,
      ...(tenantId ? { tenantId } : {}),
      fulfillmentType: FulfillmentType.MANUAL,
      status: OrderStatus.COMPLETED,
      escrowReleasedAt: null,
      dispute: {
        isNot: null,
      },
    };

    const commissionWhere: Prisma.TransactionWhereInput = {
      userId,
      walletId: wallet.id,
      type: TransactionType.CBT_COMMISSION,
      status: TransactionStatus.SUCCESS,
    };

    const [
      awaitingOrders,
      readyOrders,
      blockedOrders,
      totalHistory,
      commissionTransactions,
      serviceBreakdown,
    ] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where: awaitingReleaseWhere,
        select: {
          id: true,
          orderNumber: true,
          cbtCommission: true,
          disputeWindowExpiresAt: true,
          service: {
            select: {
              name: true,
              slug: true,
              category: {
                select: {
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: { disputeWindowExpiresAt: 'asc' },
      }),
      this.prisma.order.findMany({
        where: readyReleaseWhere,
        select: {
          id: true,
          orderNumber: true,
          cbtCommission: true,
          disputeWindowExpiresAt: true,
          service: {
            select: {
              name: true,
              slug: true,
              category: {
                select: {
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: { disputeWindowExpiresAt: 'asc' },
      }),
      this.prisma.order.findMany({
        where: blockedReleaseWhere,
        select: {
          id: true,
          orderNumber: true,
          cbtCommission: true,
          disputeWindowExpiresAt: true,
          service: {
            select: {
              name: true,
              slug: true,
              category: {
                select: {
                  name: true,
                  slug: true,
                },
              },
            },
          },
          dispute: {
            select: {
              id: true,
              status: true,
              reason: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.transaction.count({
        where: commissionWhere,
      }),
      this.prisma.transaction.findMany({
        where: commissionWhere,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          status: true,
          amount: true,
          balanceBefore: true,
          balanceAfter: true,
          reference: true,
          gatewayRef: true,
          gateway: true,
          description: true,
          createdAt: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
              escrowReleasedAt: true,
              service: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  category: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                    },
                  },
                },
              },
              requester: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.transaction.groupBy({
        by: ['orderId'],
        where: {
          ...commissionWhere,
          orderId: {
            not: null,
          },
        },
        _sum: {
          amount: true,
        },
        orderBy: {
          _sum: {
            amount: 'desc',
          },
        },
        take: 5,
      }),
    ]);

    const breakdownWithServices = serviceBreakdown.length
      ? await this.prisma.order.findMany({
          where: {
            id: {
              in: serviceBreakdown
                .map((item) => item.orderId)
                .filter((value): value is string => Boolean(value)),
            },
          },
          select: {
            id: true,
            service: {
              select: {
                id: true,
                name: true,
                slug: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        })
      : [];

    const orderLookup = new Map(
      breakdownWithServices.map((order) => [order.id, order.service]),
    );

    const awaitingReleaseAmount = awaitingOrders.reduce(
      (sum, order) => sum + order.cbtCommission,
      0n,
    );
    const readyReleaseAmount = readyOrders.reduce(
      (sum, order) => sum + order.cbtCommission,
      0n,
    );
    const blockedReleaseAmount = blockedOrders.reduce(
      (sum, order) => sum + order.cbtCommission,
      0n,
    );

    return {
      message: 'CBT earnings retrieved',
      data: {
        summary: {
          totalEarned: wallet.totalEarned.toString(),
          withdrawableBalance: wallet.availableBalance.toString(),
          totalWithdrawn: wallet.totalWithdrawn.toString(),
          awaitingReleaseAmount: awaitingReleaseAmount.toString(),
          awaitingReleaseCount: awaitingOrders.length,
          readyReleaseAmount: readyReleaseAmount.toString(),
          readyReleaseCount: readyOrders.length,
          blockedReleaseAmount: blockedReleaseAmount.toString(),
          blockedReleaseCount: blockedOrders.length,
        },
        releaseQueue: {
          awaiting: awaitingOrders.slice(0, 5).map((order) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            amount: order.cbtCommission.toString(),
            disputeWindowExpiresAt: order.disputeWindowExpiresAt,
            service: order.service,
          })),
          ready: readyOrders.slice(0, 5).map((order) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            amount: order.cbtCommission.toString(),
            disputeWindowExpiresAt: order.disputeWindowExpiresAt,
            service: order.service,
          })),
          blocked: blockedOrders.slice(0, 5).map((order) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            amount: order.cbtCommission.toString(),
            disputeWindowExpiresAt: order.disputeWindowExpiresAt,
            service: order.service,
            dispute: order.dispute,
          })),
        },
        serviceMix: serviceBreakdown.map((item) => {
          const service = item.orderId ? orderLookup.get(item.orderId) : null;
          return {
            orderId: item.orderId,
            totalAmount: item._sum?.amount?.toString() ?? '0',
            service: service
              ? {
                  id: service.id,
                  name: service.name,
                  slug: service.slug,
                  category: service.category,
                }
              : null,
          };
        }),
        history: {
          items: commissionTransactions.map((transaction) =>
            this.serializeCbtCommissionTransaction(transaction),
          ),
          meta: {
            page,
            limit,
            total: totalHistory,
            totalPages:
              totalHistory === 0 ? 0 : Math.ceil(totalHistory / limit),
            hasNextPage: page * limit < totalHistory,
          },
        },
      },
    };
  }

  async initiateFunding(userId: string, dto: InitiateWalletFundingDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        wallet: {
          select: {
            id: true,
            availableBalance: true,
          },
        },
      },
    });

    if (!user?.wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const amountKobo = BigInt(Math.round(dto.amountNaira * 100));
    const reference = generateTransactionRef();
    const callbackBaseUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const callbackUrl = `${callbackBaseUrl.replace(/\/$/, '')}/wallet`;

    await this.prisma.transaction.create({
      data: {
        walletId: user.wallet.id,
        userId: user.id,
        type: TransactionType.WALLET_FUNDING,
        status: TransactionStatus.PENDING,
        amount: amountKobo,
        balanceBefore: user.wallet.availableBalance,
        balanceAfter: user.wallet.availableBalance,
        reference,
        description: 'Wallet funding initiated',
        metadata: {
          initiatedVia: 'wallet-page',
          requester: {
            name: `${user.firstName} ${user.lastName}`.trim(),
            email: user.email,
          },
        },
      },
    });

    try {
      const initiation = await this.paymentService.initiatePayment({
        amountKobo,
        email: user.email,
        reference,
        callbackUrl,
        metadata: {
          userId: user.id,
          transactionType: 'WALLET_FUNDING',
        },
      });

      await this.prisma.transaction.update({
        where: { reference },
        data: {
          gateway: this.paymentService.gatewayName as PaymentGateway,
          gatewayRef: initiation.gatewayRef,
          metadata: {
            initiatedVia: 'wallet-page',
            checkoutMode: initiation.mode ?? 'live',
            paymentUrl: initiation.paymentUrl,
          },
        },
      });

      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'WALLET_FUNDING_INITIATED',
          entity: 'Transaction',
          entityId: reference,
          newValues: {
            amountKobo: amountKobo.toString(),
            gateway: this.paymentService.gatewayName,
            reference,
            checkoutMode: initiation.mode ?? 'live',
          },
        },
      });

      return {
        message:
          initiation.mode === 'sandbox'
            ? 'Sandbox wallet funding initialized.'
            : 'Wallet funding initialized.',
        data: {
          reference,
          paymentUrl: initiation.paymentUrl,
          gateway: this.paymentService.gatewayName,
          amountKobo: amountKobo.toString(),
          amountNaira: dto.amountNaira,
          status: TransactionStatus.PENDING,
          checkoutMode: initiation.mode ?? 'live',
        },
      };
    } catch {
      await this.prisma.transaction.update({
        where: { reference },
        data: {
          status: TransactionStatus.FAILED,
          metadata: {
            initiatedVia: 'wallet-page',
            failure: 'Payment initialization failed',
          },
        },
      });

      throw new BadGatewayException(
        'Could not initialize wallet funding right now.',
      );
    }
  }

  async confirmFundingReference(reference: string, userId: string) {
    const transaction = await this.findFundingTransaction(reference);

    if (transaction.userId !== userId) {
      throw new NotFoundException('Funding transaction not found');
    }

    const checkoutMode = this.getCheckoutMode(transaction);

    if (process.env.NODE_ENV === 'development' && checkoutMode === 'sandbox') {
      return this.completeFundingTransaction({
        transaction,
        amountKobo: transaction.amount,
        gatewayRef: transaction.gatewayRef ?? `sandbox-${reference}`,
        source: 'sandbox-confirmation',
      });
    }

    const verification = await this.paymentService.verifyPayment(reference);

    if (!verification.success) {
      await this.markFundingTransactionFailed(
        transaction.id,
        'Gateway verification did not confirm a successful payment',
      );
      throw new BadRequestException(
        'Payment has not been confirmed yet. Please try again shortly.',
      );
    }

    return this.completeFundingTransaction({
      transaction,
      amountKobo: verification.amountKobo,
      gatewayRef: verification.gatewayRef,
      source: 'gateway-verification',
    });
  }

  async handlePaymentWebhook(request: Request & { rawBody?: Buffer }) {
    const signatureHeader = this.extractSignatureHeader(request);
    const rawBody = request.rawBody;

    if (!rawBody || !signatureHeader) {
      throw new BadRequestException('Webhook payload is incomplete');
    }

    const parsed = this.paymentService.parseWebhook(
      rawBody,
      Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader,
    );

    if (!parsed.isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    if (!this.isSuccessfulPaymentEvent(parsed.event)) {
      if (this.isFailedPaymentEvent(parsed.event)) {
        const transaction = await this.findFundingTransaction(parsed.reference);
        await this.markFundingTransactionFailed(
          transaction.id,
          `Webhook failure event received: ${parsed.event}`,
        );
      }

      return {
        message: 'Webhook acknowledged',
        data: {
          processed: false,
          event: parsed.event,
          reference: parsed.reference,
        },
      };
    }

    const transaction = await this.findFundingTransaction(parsed.reference);
    const result = await this.completeFundingTransaction({
      transaction,
      amountKobo: parsed.amountKobo,
      gatewayRef: parsed.gatewayRef,
      source: 'payment-webhook',
    });

    return {
      message: 'Payment webhook processed',
      data: {
        processed: true,
        reference: parsed.reference,
        gatewayRef: parsed.gatewayRef,
        transactionStatus: result.data.status,
      },
    };
  }

  async getBanks() {
    const banks = await this.paymentService.getBanks();
    return { message: 'Banks fetched', data: banks };
  }

  async handlePayoutWebhook(request: Request & { rawBody?: Buffer }) {
    const signatureHeader = this.extractSignatureHeader(request);
    const rawBody = request.rawBody;

    if (!rawBody || !signatureHeader) {
      throw new BadRequestException('Webhook payload is incomplete');
    }

    const parsed = this.paymentService.parseWebhook(
      rawBody,
      Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader,
    );

    if (!parsed.isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Payout events: transfer.success / transfer.failed / transfer.reversed
    const isSuccess =
      parsed.event === 'transfer.success' ||
      parsed.event === 'transfer.completed';
    const isFailed =
      parsed.event === 'transfer.failed' ||
      parsed.event === 'transfer.reversed';

    if (!isSuccess && !isFailed) {
      return {
        message: 'Webhook acknowledged',
        data: { processed: false, event: parsed.event },
      };
    }

    const withdrawalRequest = await this.prisma.withdrawalRequest.findFirst({
      where: { gatewayRef: parsed.gatewayRef },
      select: {
        id: true,
        userId: true,
        amount: true,
        status: true,
        user: { select: { id: true, firstName: true, email: true } },
      },
    });

    if (!withdrawalRequest) {
      // Could be a non-Zentry transfer — ack without error
      return {
        message: 'Webhook acknowledged',
        data: { processed: false, reason: 'unknown ref' },
      };
    }

    if (isSuccess) {
      await this.prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({
          where: { userId: withdrawalRequest.userId },
          select: { id: true },
        });
        if (wallet) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { totalWithdrawn: { increment: withdrawalRequest.amount } },
          });
        }
        await tx.withdrawalRequest.update({
          where: { id: withdrawalRequest.id },
          data: { status: WithdrawalStatus.COMPLETED, processedAt: new Date() },
        });
        await tx.transaction.updateMany({
          where: {
            userId: withdrawalRequest.userId,
            type: TransactionType.WITHDRAWAL,
            status: TransactionStatus.PENDING,
            metadata: {
              path: ['withdrawalRequestId'],
              equals: withdrawalRequest.id,
            },
          },
          data: {
            status: TransactionStatus.SUCCESS,
            gatewayRef: parsed.gatewayRef,
          },
        });
      });
    } else {
      // Transfer failed/reversed — refund to wallet
      await this.prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({
          where: { userId: withdrawalRequest.userId },
          select: { id: true, availableBalance: true },
        });
        if (wallet) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { availableBalance: { increment: withdrawalRequest.amount } },
          });
        }
        await tx.withdrawalRequest.update({
          where: { id: withdrawalRequest.id },
          data: { status: WithdrawalStatus.REJECTED, processedAt: new Date() },
        });
        await tx.transaction.updateMany({
          where: {
            userId: withdrawalRequest.userId,
            type: TransactionType.WITHDRAWAL,
            status: { in: [TransactionStatus.PENDING] },
            metadata: {
              path: ['withdrawalRequestId'],
              equals: withdrawalRequest.id,
            },
          },
          data: { status: TransactionStatus.REVERSED },
        });
      });
    }

    return {
      message: 'Payout webhook processed',
      data: {
        processed: true,
        event: parsed.event,
        gatewayRef: parsed.gatewayRef,
      },
    };
  }

  private serializeWallet(wallet: WalletWithRecentTransactions) {
    return {
      id: wallet.id,
      availableBalance: wallet.availableBalance.toString(),
      escrowBalance: wallet.escrowBalance.toString(),
      totalEarned: wallet.totalEarned.toString(),
      totalWithdrawn: wallet.totalWithdrawn.toString(),
      updatedAt: wallet.updatedAt,
      recentTransactions: wallet.transactions.map((transaction) =>
        this.serializeTransaction(transaction),
      ),
    };
  }

  private serializeTransaction(transaction: WalletTransactionRecord) {
    return {
      id: transaction.id,
      type: transaction.type,
      status: transaction.status,
      amount: transaction.amount.toString(),
      balanceBefore: transaction.balanceBefore.toString(),
      balanceAfter: transaction.balanceAfter.toString(),
      reference: transaction.reference,
      gatewayRef: transaction.gatewayRef,
      gateway: transaction.gateway,
      description: transaction.description,
      createdAt: transaction.createdAt,
    };
  }

  private serializeCbtCommissionTransaction(
    transaction: CbtCommissionTransactionRecord,
  ) {
    return {
      ...this.serializeTransaction(transaction),
      order: transaction.order
        ? {
            id: transaction.order.id,
            orderNumber: transaction.order.orderNumber,
            escrowReleasedAt: transaction.order.escrowReleasedAt,
            service: {
              id: transaction.order.service.id,
              name: transaction.order.service.name,
              slug: transaction.order.service.slug,
              category: transaction.order.service.category,
            },
            requester: {
              id: transaction.order.requester.id,
              firstName: transaction.order.requester.firstName,
              lastName: transaction.order.requester.lastName,
              email: transaction.order.requester.email,
            },
          }
        : null,
    };
  }

  private serializeAdminRecentCbtCommission(
    transaction: AdminRecentCbtCommissionRecord,
  ) {
    return {
      id: transaction.id,
      amount: transaction.amount.toString(),
      reference: transaction.reference,
      createdAt: transaction.createdAt,
      cbt: {
        id: transaction.user.id,
        firstName: transaction.user.firstName,
        lastName: transaction.user.lastName,
        email: transaction.user.email,
      },
      order: transaction.order
        ? {
            id: transaction.order.id,
            orderNumber: transaction.order.orderNumber,
            service: {
              id: transaction.order.service.id,
              name: transaction.order.service.name,
              slug: transaction.order.service.slug,
              category: transaction.order.service.category,
            },
          }
        : null,
    };
  }

  private serializeWithdrawalRequest(request: WithdrawalRequestRecord) {
    return {
      id: request.id,
      amount: request.amount.toString(),
      bankName: request.bankName,
      bankCode: request.bankCode,
      accountNumber: this.maskAccountNumber(request.accountNumber),
      accountName: request.accountName,
      status: request.status,
      processorNote: request.processorNote,
      gatewayRef: request.gatewayRef,
      processedAt: request.processedAt,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  private serializeAdminWithdrawalRequest(
    request: AdminWithdrawalRequestRecord,
  ) {
    return {
      ...this.serializeWithdrawalRequest(request),
      user: request.user,
    };
  }

  private async ensureApprovedCbtUser(userId: string, tenantId: string | null) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        ...(tenantId ? { tenantId } : { tenantId: null }),
      },
      select: {
        id: true,
        cbtProfile: {
          select: {
            approvalStatus: true,
          },
        },
      },
    });

    if (!user?.cbtProfile) {
      throw new NotFoundException('CBT profile not found');
    }

    if (user.cbtProfile.approvalStatus !== CbtApprovalStatus.APPROVED) {
      throw new ForbiddenException(
        'Your CBT center must be approved before it can request withdrawals.',
      );
    }

    return user;
  }

  private async ensureWithdrawalEligibleUser(
    userId: string,
    tenantId: string | null,
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        ...(tenantId ? { tenantId } : { tenantId: null }),
      },
      select: {
        id: true,
        role: true,
        cbtProfile: {
          select: {
            approvalStatus: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      return user;
    }

    if (!user.cbtProfile) {
      throw new ForbiddenException(
        'Only approved CBT centers or the platform owner can request withdrawals.',
      );
    }

    if (user.cbtProfile.approvalStatus !== CbtApprovalStatus.APPROVED) {
      throw new ForbiddenException(
        'Your CBT center must be approved before it can request withdrawals.',
      );
    }

    return user;
  }

  private assertWithdrawalTransition(
    currentStatus: WithdrawalStatus,
    nextStatus: WithdrawalStatus,
  ) {
    const transitions: Record<WithdrawalStatus, WithdrawalStatus[]> = {
      [WithdrawalStatus.PENDING]: [
        WithdrawalStatus.APPROVED,
        WithdrawalStatus.REJECTED,
      ],
      [WithdrawalStatus.APPROVED]: [
        WithdrawalStatus.PROCESSING,
        WithdrawalStatus.COMPLETED,
        WithdrawalStatus.REJECTED,
      ],
      [WithdrawalStatus.PROCESSING]: [
        WithdrawalStatus.COMPLETED,
        WithdrawalStatus.REJECTED,
      ],
      [WithdrawalStatus.COMPLETED]: [],
      [WithdrawalStatus.REJECTED]: [],
    };

    if (!transitions[currentStatus].includes(nextStatus)) {
      throw new ConflictException(
        `Cannot move a withdrawal request from ${currentStatus} to ${nextStatus}.`,
      );
    }
  }

  private getWithdrawalReviewMessage(status: WithdrawalStatus) {
    switch (status) {
      case WithdrawalStatus.APPROVED:
        return 'Withdrawal request approved.';
      case WithdrawalStatus.PROCESSING:
        return 'Withdrawal request moved into processing.';
      case WithdrawalStatus.COMPLETED:
        return 'Withdrawal request marked as completed.';
      case WithdrawalStatus.REJECTED:
        return 'Withdrawal request rejected and funds restored.';
      default:
        return 'Withdrawal request updated.';
    }
  }

  private maskAccountNumber(accountNumber: string) {
    return accountNumber.replace(/\d(?=\d{4})/g, '*');
  }

  private toMetadataRecord(
    value: Prisma.JsonValue | undefined,
  ): Record<string, Prisma.JsonValue> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, Prisma.JsonValue>;
  }

  private async findFundingTransaction(reference: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { reference },
      select: {
        id: true,
        walletId: true,
        userId: true,
        type: true,
        status: true,
        amount: true,
        reference: true,
        gateway: true,
        gatewayRef: true,
        metadata: true,
        wallet: {
          select: {
            id: true,
            availableBalance: true,
          },
        },
      },
    });

    if (!transaction || transaction.type !== TransactionType.WALLET_FUNDING) {
      throw new NotFoundException('Funding transaction not found');
    }

    return transaction;
  }

  private buildTransactionDateFilter(query: GetWalletTransactionsQueryDto) {
    if (!query.startDate && !query.endDate) {
      return null;
    }

    const createdAt: Prisma.DateTimeFilter = {};

    if (query.startDate) {
      const startDate = new Date(query.startDate);

      if (Number.isNaN(startDate.getTime())) {
        throw new BadRequestException('Start date is invalid.');
      }

      createdAt.gte = startDate;
    }

    if (query.endDate) {
      const endDate = new Date(query.endDate);

      if (Number.isNaN(endDate.getTime())) {
        throw new BadRequestException('End date is invalid.');
      }

      endDate.setUTCHours(23, 59, 59, 999);
      createdAt.lte = endDate;
    }

    if (createdAt.gte && createdAt.lte && createdAt.gte > createdAt.lte) {
      throw new BadRequestException(
        'Start date must be earlier than end date.',
      );
    }

    return createdAt;
  }

  private buildAdminUserFilter(
    role?: UserRole,
    search?: string,
    tenantId?: string | null,
  ) {
    if (!role && !search && !tenantId) {
      return null;
    }

    return {
      ...(role ? { role } : {}),
      ...(tenantId ? { tenantId } : {}),
      ...(search
        ? {
            OR: [
              {
                firstName: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                lastName: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                email: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
    };
  }

  private getCheckoutMode(transaction: FundingTransactionRecord) {
    if (
      transaction.metadata &&
      typeof transaction.metadata === 'object' &&
      !Array.isArray(transaction.metadata) &&
      'checkoutMode' in transaction.metadata
    ) {
      const checkoutMode = (transaction.metadata as Record<string, unknown>)[
        'checkoutMode'
      ];
      return typeof checkoutMode === 'string' ? checkoutMode : null;
    }

    return null;
  }

  private async completeFundingTransaction({
    transaction,
    amountKobo,
    gatewayRef,
    source,
  }: {
    transaction: FundingTransactionRecord;
    amountKobo: bigint;
    gatewayRef: string;
    source: 'payment-webhook' | 'gateway-verification' | 'sandbox-confirmation';
  }) {
    if (transaction.status === TransactionStatus.SUCCESS) {
      return {
        message: 'Wallet funding already confirmed.',
        data: {
          reference: transaction.reference,
          status: transaction.status,
          amountKobo: transaction.amount.toString(),
        },
      };
    }

    if (transaction.status === TransactionStatus.FAILED) {
      throw new BadRequestException(
        'This funding transaction has already been marked as failed.',
      );
    }

    if (amountKobo !== transaction.amount) {
      await this.markFundingTransactionFailed(
        transaction.id,
        'Confirmed gateway amount did not match the pending funding amount',
      );
      throw new BadRequestException(
        'Confirmed amount did not match the original funding request.',
      );
    }

    const claimed = await this.prisma.transaction.updateMany({
      where: { id: transaction.id, status: TransactionStatus.PENDING },
      data: { status: TransactionStatus.SUCCESS },
    });

    if (claimed.count === 0) {
      return {
        message: 'Wallet funding already processed.',
        data: {
          reference: transaction.reference,
          status: TransactionStatus.SUCCESS,
          amountKobo: transaction.amount.toString(),
        },
      };
    }

    const updatedTransaction = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { id: transaction.walletId },
        select: { id: true, availableBalance: true },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      const balanceBefore = wallet.availableBalance;
      const balanceAfter = balanceBefore + amountKobo;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { increment: amountKobo },
        },
      });

      const updated = await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.SUCCESS,
          gatewayRef,
          gateway:
            transaction.gateway ??
            (this.paymentService.gatewayName as PaymentGateway),
          balanceBefore,
          balanceAfter,
          metadata: {
            ...(transaction.metadata &&
            typeof transaction.metadata === 'object' &&
            !Array.isArray(transaction.metadata)
              ? (transaction.metadata as Record<string, unknown>)
              : {}),
            confirmationSource: source,
          },
        },
        select: {
          reference: true,
          status: true,
          amount: true,
          gateway: true,
          gatewayRef: true,
          balanceAfter: true,
        },
      });

      await tx.notification.create({
        data: {
          userId: transaction.userId,
          type: 'WALLET_FUNDED',
          title: 'Wallet funded successfully',
          message: `Your wallet has been credited with ${amountKobo.toString()} kobo.`,
          metadata: {
            reference: transaction.reference,
            amountKobo: amountKobo.toString(),
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: transaction.userId,
          action: 'WALLET_FUNDED',
          entity: 'Transaction',
          entityId: transaction.id,
          newValues: {
            reference: transaction.reference,
            amountKobo: amountKobo.toString(),
            gatewayRef,
            source,
          },
        },
      });

      return updated;
    });

    // Real-time: tell client to refresh wallet balance
    this.notificationsService.broadcastWalletUpdated(transaction.userId);

    return {
      message: 'Wallet funding confirmed.',
      data: {
        reference: updatedTransaction.reference,
        status: updatedTransaction.status,
        amountKobo: updatedTransaction.amount.toString(),
        gateway: updatedTransaction.gateway,
        gatewayRef: updatedTransaction.gatewayRef,
        balanceAfter: updatedTransaction.balanceAfter.toString(),
      },
    };
  }

  private async markFundingTransactionFailed(
    transactionId: string,
    reason: string,
  ) {
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.FAILED,
        metadata: {
          failureReason: reason,
        },
      },
    });
  }

  private extractSignatureHeader(request: Request) {
    switch (this.paymentService.gatewayName) {
      case PaymentGateway.PAYSTACK:
        return request.headers['x-paystack-signature'];
      case PaymentGateway.FLUTTERWAVE:
        return (
          request.headers['verif-hash'] ??
          request.headers['x-flutterwave-signature']
        );
      case PaymentGateway.FINTAVAPAY:
      default:
        return (
          request.headers['x-fintavapay-signature'] ??
          request.headers['x-webhook-signature']
        );
    }
  }

  private isSuccessfulPaymentEvent(event: string) {
    const normalized = event.toLowerCase();
    return (
      normalized.includes('success') ||
      normalized.includes('successful') ||
      normalized.includes('completed')
    );
  }

  private isFailedPaymentEvent(event: string) {
    const normalized = event.toLowerCase();
    return (
      normalized.includes('fail') ||
      normalized.includes('cancel') ||
      normalized.includes('abandon') ||
      normalized.includes('expire') ||
      normalized.includes('reverse')
    );
  }
}
