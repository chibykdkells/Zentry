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
import {
  formatNaira,
  generateTransactionRef,
  nairaToKobo,
} from '@zendocx/utils';
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

const FUNDING_FEE_RATE_BASIS_POINTS = 250n;
const FUNDING_FEE_CAP_KOBO = 60_000n;
const BASIS_POINTS_DENOMINATOR = 10_000n;

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
    createdAt: true;
    wallet: {
      select: {
        id: true;
        availableBalance: true;
      };
    };
    user: {
      select: {
        id: true;
        email: true;
        firstName: true;
        lastName: true;
        role: true;
        tenantId: true;
      };
    };
  };
}>;

type FundingVerificationPreview = {
  success: boolean;
  amountKobo: string | null;
  gatewayRef: string | null;
  paidAt: string | null;
  error: string | null;
};

type WithdrawalRequestRecord = Prisma.WithdrawalRequestGetPayload<{
  select: {
    id: true;
    amount: true;
    feeKobo: true;
    payoutKobo: true;
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
    feeKobo: true;
    payoutKobo: true;
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

  private async resolveTenantSender(
    tenantId: string | null,
  ): Promise<{ fromEmail?: string; fromName?: string }> {
    if (!tenantId) return {};
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, customDomain: true, customDomainVerified: true },
    });
    if (tenant?.customDomainVerified && tenant.customDomain) {
      return {
        fromEmail: `noreply@${tenant.customDomain}`,
        fromName: tenant.name,
      };
    }
    return {};
  }

  private async sendEmailSafely(input: {
    to: string;
    subject: string;
    html: string;
    text: string;
    fromEmail?: string;
    fromName?: string;
  }) {
    await this.emailService.sendEmail(input).catch(() => undefined);
  }

  async getMyWalletOverview(userId: string, tenantId: string | null) {
    // Fire-and-forget — reconciliation makes external gateway API calls and must
    // never block the wallet page load. Any errors are caught inside the method.
    void this.reconcileRecentPendingFundings(userId);

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
    const tenantSql = tenantId
      ? Prisma.sql`AND "tenantId" = ${tenantId}`
      : Prisma.sql``;
    const [
      walletAggregate,
      walletCount,
      fundedWalletCount,
      pendingFundingCount,
      successfulFundingAggregate,
      platformCommissionAggregate,
      cbtCommissionAggregate,
      withdrawalAggregate,
      withdrawalStatusSummary,
      refundAggregate,
      heldFundsByTenant,
      capturedFundingFeeAggregate,
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
      this.prisma.withdrawalRequest.groupBy({
        by: ['status'],
        where: tf,
        orderBy: {
          status: 'asc',
        },
        _sum: {
          amount: true,
        },
        _count: {
          _all: true,
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
      this.prisma.$queryRaw<Array<{ total: bigint | null }>>`
        SELECT COALESCE(
          SUM(
            CASE
              WHEN jsonb_typeof(COALESCE(metadata::jsonb, '{}'::jsonb)) = 'object'
                AND COALESCE(metadata::jsonb, '{}'::jsonb) ? 'fundingFeeKobo'
              THEN NULLIF(metadata::jsonb->>'fundingFeeKobo', '')::bigint
              WHEN jsonb_typeof(COALESCE(metadata::jsonb, '{}'::jsonb)) = 'object'
                AND COALESCE(metadata::jsonb, '{}'::jsonb) ? 'gatewayFeeKobo'
              THEN NULLIF(metadata::jsonb->>'gatewayFeeKobo', '')::bigint
              ELSE 0
            END
          ),
          0
        ) AS total
        FROM "Transaction"
        WHERE type = ${TransactionType.WALLET_FUNDING}::"TransactionType"
          AND status = ${TransactionStatus.SUCCESS}::"TransactionStatus"
          ${tenantSql}
      `,
    ]);

    const withdrawalSummary = withdrawalStatusSummary.reduce(
      (acc, item) => {
        const amount = item._sum?.amount?.toString() ?? '0';
        const count =
          typeof item._count === 'object' && item._count
            ? (item._count._all ?? 0)
            : 0;

        switch (item.status) {
          case WithdrawalStatus.PENDING:
            acc.pendingWithdrawalAmount = amount;
            acc.pendingWithdrawalCount = count;
            break;
          case WithdrawalStatus.APPROVED:
            acc.approvedWithdrawalAmount = amount;
            acc.approvedWithdrawalCount = count;
            break;
          case WithdrawalStatus.PROCESSING:
            acc.processingWithdrawalAmount = amount;
            acc.processingWithdrawalCount = count;
            break;
          case WithdrawalStatus.COMPLETED:
            acc.completedWithdrawalAmount = amount;
            acc.completedWithdrawalCount = count;
            break;
          case WithdrawalStatus.REJECTED:
            acc.rejectedWithdrawalAmount = amount;
            acc.rejectedWithdrawalCount = count;
            break;
        }

        return acc;
      },
      {
        pendingWithdrawalAmount: '0',
        pendingWithdrawalCount: 0,
        approvedWithdrawalAmount: '0',
        approvedWithdrawalCount: 0,
        processingWithdrawalAmount: '0',
        processingWithdrawalCount: 0,
        completedWithdrawalAmount: '0',
        completedWithdrawalCount: 0,
        rejectedWithdrawalAmount: '0',
        rejectedWithdrawalCount: 0,
      },
    );

    const payoutReviewAmount = (
      BigInt(withdrawalSummary.pendingWithdrawalAmount) +
      BigInt(withdrawalSummary.approvedWithdrawalAmount) +
      BigInt(withdrawalSummary.processingWithdrawalAmount)
    ).toString();
    const payoutReviewCount =
      withdrawalSummary.pendingWithdrawalCount +
      withdrawalSummary.approvedWithdrawalCount +
      withdrawalSummary.processingWithdrawalCount;

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
        capturedFundingFeeVolume:
          capturedFundingFeeAggregate[0]?.total?.toString() ?? '0',
        payoutReviewAmount,
        payoutReviewCount,
        ...withdrawalSummary,
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
          feeKobo: true,
          payoutKobo: true,
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
          feeKobo: true,
          payoutKobo: true,
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

    // 2.99% withdrawal charge — platform retains (2.99% - 1.5%) = 1.49% after FintavaPay fee.
    // Bank transfers are whole-naira (no kobo), so floor the payout to the nearest naira and
    // let the fee absorb the sub-naira remainder — keeps amount = payoutKobo + feeKobo exact
    // and guarantees the payout can actually be transferred.
    const rawPayoutKobo = amount - BigInt(Math.ceil(Number(amount) * 0.0299));
    const payoutKobo = rawPayoutKobo - (rawPayoutKobo % 100n);
    const feeKobo = amount - payoutKobo;

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
          feeKobo,
          payoutKobo,
          bankName: dto.bankName.trim(),
          bankCode: dto.bankCode.trim(),
          accountNumber: dto.accountNumber.trim(),
          accountName: dto.accountName.trim(),
          status: WithdrawalStatus.PENDING,
        },
        select: {
          id: true,
          amount: true,
          feeKobo: true,
          payoutKobo: true,
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
          feeKobo: true,
          payoutKobo: true,
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
            feeKobo: true,
            payoutKobo: true,
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
            feeKobo: true,
            payoutKobo: true,
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
    const withdrawalSender = await this.resolveTenantSender(tenantId);
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
      ...withdrawalSender,
    });

    // Auto-initiate bank transfer when admin approves.
    if (dto.status === WithdrawalStatus.APPROVED) {
      await this.initiateWithdrawalPayout({
        id: result.id,
        amount: result.amount,
        payoutKobo: result.payoutKobo,
        accountNumber: result.accountNumber,
        bankCode: result.bankCode,
        accountName: result.accountName,
        userId: result.user.id,
      });
    }

    return {
      message: this.getWithdrawalReviewMessage(dto.status),
      data: this.serializeWithdrawalRequest(result),
    };
  }

  // Sends the actual bank payout for an approved withdrawal. Floors the amount to
  // whole naira (FintavaPay/bank transfers cannot carry kobo) and advances the
  // request to PROCESSING — or COMPLETED if the gateway settles instantly. On
  // failure it records the reason on the request (instead of failing silently) so
  // an admin can see what happened and retry, and leaves the status at APPROVED.
  private async initiateWithdrawalPayout(request: {
    id: string;
    amount: bigint;
    payoutKobo: bigint;
    accountNumber: string;
    bankCode: string;
    accountName: string;
    userId: string;
  }): Promise<{ ok: boolean; error?: string }> {
    const payoutRef = `ZDX-PAYOUT-${request.id.replace(/-/g, '').slice(0, 16).toUpperCase()}`;
    try {
      // payoutKobo (amount minus fee), floored to whole naira since bank transfers
      // cannot carry kobo. Fall back to amount for legacy rows without payoutKobo.
      const rawTransfer =
        request.payoutKobo > 0n ? request.payoutKobo : request.amount;
      const transferAmount = rawTransfer - (rawTransfer % 100n);
      if (transferAmount <= 0n) {
        throw new Error('Payout rounds to zero naira');
      }

      const transferResult = await this.paymentService.initiateTransfer({
        amountKobo: transferAmount,
        accountNumber: request.accountNumber,
        bankCode: request.bankCode,
        accountName: request.accountName,
        reference: payoutRef,
        narration: `ZenDocx withdrawal ${request.id}`,
      });

      // Advance to PROCESSING, store the gateway reference, clear any prior error.
      await this.prisma.withdrawalRequest.update({
        where: { id: request.id },
        data: {
          status: WithdrawalStatus.PROCESSING,
          gatewayRef: transferResult.gatewayRef,
          processorNote: null,
        },
      });

      if (transferResult.status === 'SUCCESS') {
        // Gateway settled immediately — mark COMPLETED.
        await this.prisma.$transaction(async (tx) => {
          const wallet = await tx.wallet.findUnique({
            where: { userId: request.userId },
            select: { id: true },
          });
          if (wallet) {
            await tx.wallet.update({
              where: { id: wallet.id },
              data: { totalWithdrawn: { increment: request.amount } },
            });
          }
          await tx.withdrawalRequest.update({
            where: { id: request.id },
            data: {
              status: WithdrawalStatus.COMPLETED,
              processedAt: new Date(),
            },
          });
          await tx.transaction.updateMany({
            where: {
              userId: request.userId,
              type: TransactionType.WITHDRAWAL,
              status: TransactionStatus.PENDING,
              metadata: { path: ['withdrawalRequestId'], equals: request.id },
            },
            data: {
              status: TransactionStatus.SUCCESS,
              gatewayRef: transferResult.gatewayRef,
            },
          });
        });
      }

      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Payout initiation failed for withdrawal ${request.id}: ${message}`,
      );
      // Surface the failure on the request instead of leaving it silently stuck.
      await this.prisma.withdrawalRequest
        .update({
          where: { id: request.id },
          data: { processorNote: `Automated payout failed: ${message}` },
        })
        .catch(() => undefined);
      return { ok: false, error: message };
    }
  }

  // Re-attempts the bank payout for a withdrawal that was approved but whose
  // automated transfer failed (it stays APPROVED). Admin-triggered.
  async retryWithdrawalPayout(
    adminUserId: string,
    withdrawalRequestId: string,
    tenantId: string | null = null,
  ) {
    const request = await this.prisma.withdrawalRequest.findFirst({
      where: {
        id: withdrawalRequestId,
        ...(tenantId ? { tenantId } : {}),
      },
      select: {
        id: true,
        amount: true,
        payoutKobo: true,
        accountNumber: true,
        bankCode: true,
        accountName: true,
        status: true,
        userId: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Withdrawal request not found.');
    }

    if (request.status !== WithdrawalStatus.APPROVED) {
      throw new BadRequestException(
        'Only an approved withdrawal with a failed payout can be retried.',
      );
    }

    const outcome = await this.initiateWithdrawalPayout({
      id: request.id,
      amount: request.amount,
      payoutKobo: request.payoutKobo,
      accountNumber: request.accountNumber,
      bankCode: request.bankCode,
      accountName: request.accountName,
      userId: request.userId,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'WITHDRAWAL_PAYOUT_RETRIED',
        entity: 'WithdrawalRequest',
        entityId: request.id,
        newValues: { ok: outcome.ok, error: outcome.error ?? null },
      },
    });

    if (!outcome.ok) {
      throw new BadRequestException(
        `Payout retry failed: ${outcome.error ?? 'unknown error'}`,
      );
    }

    return { message: 'Payout re-initiated.', data: { id: request.id } };
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

  async getAdminFundingReconciliationPreview(reference: string) {
    const normalizedReference = reference.trim();
    const transaction = await this.findFundingTransaction(normalizedReference);
    const checkoutMode = this.getCheckoutMode(transaction);
    const callbackUrl = this.getFundingCallbackUrl(transaction);
    const reasons: string[] = [];

    if (
      transaction.gateway &&
      transaction.gateway !==
        (this.paymentService.gatewayName as PaymentGateway)
    ) {
      reasons.push(
        `This funding was initialized on ${transaction.gateway}, but the current active gateway is ${this.paymentService.gatewayName}. Switch the active gateway before reconciling this reference automatically.`,
      );
    }

    const verification =
      process.env.NODE_ENV === 'development' && checkoutMode === 'sandbox'
        ? {
            success: true,
            amountKobo:
              this.getExpectedFundingPaymentKobo(transaction).toString(),
            gatewayRef:
              transaction.gatewayRef ?? `sandbox-${transaction.reference}`,
            paidAt: null,
            error: null,
          }
        : await this.paymentService
            .verifyPayment(normalizedReference)
            .then(
              (result): FundingVerificationPreview => ({
                success: result.success,
                amountKobo: result.amountKobo.toString(),
                gatewayRef: result.gatewayRef,
                paidAt: result.paidAt?.toISOString() ?? null,
                error: null,
              }),
            )
            .catch(
              (error: unknown): FundingVerificationPreview => ({
                success: false,
                amountKobo: null,
                gatewayRef: null,
                paidAt: null,
                error:
                  error instanceof Error
                    ? error.message
                    : 'Gateway verification failed.',
              }),
            );

    if (verification.error) {
      reasons.push(
        'Gateway verification could not be completed for this reference. Confirm the payment in the provider dashboard before trying again.',
      );
    } else if (!verification.success) {
      reasons.push(
        'The payment provider has not confirmed this reference as successful yet.',
      );
    } else if (
      verification.amountKobo !==
      this.getExpectedFundingPaymentKobo(transaction).toString()
    ) {
      reasons.push(
        'The provider confirmed a different amount than the pending wallet funding record.',
      );
    }

    return {
      message: 'Admin funding reconciliation preview retrieved',
      data: {
        reference: transaction.reference,
        canApply: reasons.length === 0,
        reasons,
        transaction: {
          id: transaction.id,
          status: transaction.status,
          gateway: transaction.gateway,
          gatewayRef: transaction.gatewayRef,
          amountKobo: transaction.amount.toString(),
          callbackUrl,
          checkoutMode,
          createdAt: transaction.createdAt.toISOString(),
        },
        user: {
          id: transaction.user.id,
          email: transaction.user.email,
          firstName: transaction.user.firstName,
          lastName: transaction.user.lastName,
          role: transaction.user.role,
          tenantId: transaction.user.tenantId,
        },
        verification,
      },
    };
  }

  async applyAdminFundingReconciliation(
    reference: string,
    adminUserId: string,
  ) {
    const normalizedReference = reference.trim();
    const preview =
      await this.getAdminFundingReconciliationPreview(normalizedReference);

    if (!preview.data.canApply) {
      throw new ConflictException(
        preview.data.reasons[0] ??
          'This funding reference is not eligible for automatic reconciliation.',
      );
    }

    const transaction = await this.findFundingTransaction(normalizedReference);
    const checkoutMode = this.getCheckoutMode(transaction);

    const verification =
      process.env.NODE_ENV === 'development' && checkoutMode === 'sandbox'
        ? {
            success: true,
            amountKobo: this.getExpectedFundingPaymentKobo(transaction),
            gatewayRef:
              transaction.gatewayRef ?? `sandbox-${transaction.reference}`,
            feeKobo: this.getStoredFundingFeeKobo(transaction),
          }
        : await this.paymentService.verifyPayment(normalizedReference);

    if (!verification.success) {
      throw new BadRequestException(
        'The payment provider has not confirmed this reference as successful yet.',
      );
    }

    const result = await this.completeFundingTransaction({
      transaction,
      amountKobo: verification.amountKobo,
      gatewayRef: verification.gatewayRef,
      fundingFeeKobo: this.getStoredFundingFeeKobo(transaction),
      source: 'admin-reconciliation',
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'ADMIN_WALLET_FUNDING_RECONCILED',
        entity: 'Transaction',
        entityId: transaction.id,
        newValues: {
          reference: transaction.reference,
          amountKobo: transaction.amount.toString(),
          fundingFeeKobo: this.getStoredFundingFeeKobo(transaction).toString(),
          gateway: transaction.gateway,
          gatewayRef: verification.gatewayRef,
        },
      },
    });

    return {
      message:
        result.message === 'Wallet funding already confirmed.'
          ? 'Funding reference was already credited.'
          : 'Funding reference reconciled successfully.',
      data: {
        ...result.data,
        reconciledByAdmin: true,
      },
    };
  }

  async getMyTransactions(
    userId: string,
    query: GetWalletTransactionsQueryDto,
    tenantId: string | null,
  ) {
    void this.reconcileRecentPendingFundings(userId);

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

  private normalizeFrontendOrigin(value: string | null | undefined) {
    if (!value?.trim()) {
      return null;
    }

    try {
      const url = new URL(value.trim());
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null;
      }
      return url.origin;
    } catch {
      return null;
    }
  }

  private buildFundingCallbackUrl(requestOrigin?: string | null) {
    const baseOrigin =
      this.normalizeFrontendOrigin(requestOrigin) ??
      this.normalizeFrontendOrigin(process.env.FRONTEND_URL) ??
      'http://localhost:3000';

    return `${baseOrigin.replace(/\/$/, '')}/wallet`;
  }

  async initiateFunding(
    userId: string,
    dto: InitiateWalletFundingDto,
    requestOrigin?: string | null,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
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
    const fundingFeeKobo = this.calculateFundingFeeKobo(amountKobo);
    const fundingTotalKobo = amountKobo + fundingFeeKobo;
    const reference = generateTransactionRef();
    const callbackUrl = this.buildFundingCallbackUrl(requestOrigin);
    const customerName = `${user.firstName} ${user.lastName}`.trim();

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
          callbackUrl,
          fundingFeeKobo: fundingFeeKobo.toString(),
          fundingTotalKobo: fundingTotalKobo.toString(),
          requester: { name: customerName, email: user.email },
        },
      },
    });

    try {
      const initiation = await this.paymentService.initiatePayment({
        amountKobo: fundingTotalKobo,
        email: user.email,
        customerName,
        phone: user.phone ?? undefined,
        reference,
        callbackUrl,
        expireTimeInMin: 30,
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
            paymentUrl: initiation.paymentUrl ?? null,
            callbackUrl,
            fundingFeeKobo: fundingFeeKobo.toString(),
            fundingTotalKobo: fundingTotalKobo.toString(),
            virtualAccount: initiation.virtualAccount
              ? {
                  accountNumber: initiation.virtualAccount.accountNumber,
                  bankName: initiation.virtualAccount.bankName,
                  expiresAt: initiation.virtualAccount.expiresAt.toISOString(),
                }
              : null,
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
            fundingFeeKobo: fundingFeeKobo.toString(),
            fundingTotalKobo: fundingTotalKobo.toString(),
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
          paymentUrl: initiation.paymentUrl ?? null,
          virtualAccount: initiation.virtualAccount ?? null,
          gateway: this.paymentService.gatewayName,
          amountKobo: amountKobo.toString(),
          fundingFeeKobo: fundingFeeKobo.toString(),
          fundingTotalKobo: fundingTotalKobo.toString(),
          amountNaira: dto.amountNaira,
          status: TransactionStatus.PENDING,
          checkoutMode: initiation.mode ?? 'live',
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`initiateFunding failed for user ${userId}: ${msg}`);

      await this.prisma.transaction.update({
        where: { reference },
        data: {
          status: TransactionStatus.FAILED,
          metadata: {
            initiatedVia: 'wallet-page',
            fundingFeeKobo: fundingFeeKobo.toString(),
            fundingTotalKobo: fundingTotalKobo.toString(),
            failure: msg,
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
        amountKobo: this.getExpectedFundingPaymentKobo(transaction),
        gatewayRef: transaction.gatewayRef ?? `sandbox-${reference}`,
        fundingFeeKobo: this.getStoredFundingFeeKobo(transaction),
        source: 'sandbox-confirmation',
      });
    }

    let verification: Awaited<
      ReturnType<typeof this.paymentService.verifyPayment>
    >;
    try {
      verification = await this.paymentService.verifyPayment(reference);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `verifyPayment threw for reference ${reference}: ${msg}`,
      );
      throw new BadRequestException(
        'Payment has not been confirmed yet. Please try again shortly.',
      );
    }

    if (!verification.success) {
      // Leave PENDING — the webhook will credit it once FintavaPay processes the transfer.
      throw new BadRequestException(
        'Payment has not been confirmed yet. Please try again shortly.',
      );
    }

    return this.completeFundingTransaction({
      transaction,
      amountKobo: verification.amountKobo,
      gatewayRef: verification.gatewayRef,
      fundingFeeKobo: this.getStoredFundingFeeKobo(transaction),
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
      amountKobo: this.getExpectedFundingPaymentKobo(transaction),
      gatewayRef: parsed.gatewayRef,
      fundingFeeKobo: this.getStoredFundingFeeKobo(transaction),
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
      // Could be a non-ZenDocx transfer — ack without error
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
      feeKobo: request.feeKobo.toString(),
      payoutKobo: request.payoutKobo.toString(),
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

    if (user.role === UserRole.TENANT_ADMIN) {
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

  private calculateFundingFeeKobo(amountKobo: bigint) {
    const percentageFee =
      (amountKobo * FUNDING_FEE_RATE_BASIS_POINTS +
        BASIS_POINTS_DENOMINATOR -
        1n) /
      BASIS_POINTS_DENOMINATOR;
    const wholeNairaFee =
      percentageFee % 100n === 0n
        ? percentageFee
        : percentageFee + (100n - (percentageFee % 100n));

    return wholeNairaFee > FUNDING_FEE_CAP_KOBO
      ? FUNDING_FEE_CAP_KOBO
      : wholeNairaFee;
  }

  private getStoredFundingFeeKobo(transaction: FundingTransactionRecord) {
    const metadata = this.toMetadataRecord(transaction.metadata);
    const rawFee = metadata.fundingFeeKobo ?? metadata.gatewayFeeKobo;

    if (typeof rawFee === 'string' && /^\d+$/.test(rawFee)) {
      return BigInt(rawFee);
    }

    if (
      typeof rawFee === 'number' &&
      Number.isSafeInteger(rawFee) &&
      rawFee >= 0
    ) {
      return BigInt(rawFee);
    }

    return 0n;
  }

  private getExpectedFundingPaymentKobo(transaction: FundingTransactionRecord) {
    return transaction.amount + this.getStoredFundingFeeKobo(transaction);
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
        createdAt: true,
        wallet: {
          select: {
            id: true,
            availableBalance: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            tenantId: true,
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

  private getFundingCallbackUrl(transaction: FundingTransactionRecord) {
    const callbackUrl = this.toMetadataRecord(transaction.metadata).callbackUrl;
    return typeof callbackUrl === 'string' ? callbackUrl : null;
  }

  private async reconcileRecentPendingFundings(userId: string) {
    const recentPendingFundings = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: TransactionType.WALLET_FUNDING,
        status: TransactionStatus.PENDING,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
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
        createdAt: true,
        wallet: {
          select: {
            id: true,
            availableBalance: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            tenantId: true,
          },
        },
      },
    });

    for (const transaction of recentPendingFundings) {
      try {
        const verification = await this.paymentService.verifyPayment(
          transaction.reference,
        );

        if (!verification.success) {
          continue;
        }

        await this.completeFundingTransaction({
          transaction,
          amountKobo: verification.amountKobo,
          gatewayRef: verification.gatewayRef,
          fundingFeeKobo: this.getStoredFundingFeeKobo(transaction),
          source: 'gateway-verification',
        });
      } catch (error) {
        this.logger.warn(
          `Pending funding reconciliation skipped for ${transaction.reference}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }
  }

  private async completeFundingTransaction({
    transaction,
    amountKobo,
    gatewayRef,
    fundingFeeKobo,
    source,
  }: {
    transaction: FundingTransactionRecord;
    amountKobo: bigint;
    gatewayRef: string;
    fundingFeeKobo?: bigint;
    source:
      | 'payment-webhook'
      | 'gateway-verification'
      | 'sandbox-confirmation'
      | 'admin-reconciliation';
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

    const expectedPaymentKobo = this.getExpectedFundingPaymentKobo(transaction);
    const walletCreditKobo = transaction.amount;
    const chargedFundingFeeKobo =
      fundingFeeKobo ?? this.getStoredFundingFeeKobo(transaction);

    if (amountKobo !== expectedPaymentKobo) {
      await this.markFundingTransactionFailed(
        transaction.id,
        'Confirmed gateway amount did not match the pending funding amount',
      );
      throw new BadRequestException(
        'Confirmed amount did not match the original funding request.',
      );
    }

    const updatedTransaction = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.transaction.updateMany({
        where: {
          id: transaction.id,
          status: { in: [TransactionStatus.PENDING, TransactionStatus.FAILED] },
        },
        data: { status: TransactionStatus.SUCCESS },
      });

      if (claimed.count === 0) {
        const existing = await tx.transaction.findUnique({
          where: { id: transaction.id },
          select: {
            reference: true,
            status: true,
            amount: true,
            gateway: true,
            gatewayRef: true,
            balanceAfter: true,
          },
        });

        if (!existing) {
          throw new NotFoundException('Funding transaction not found');
        }

        return existing;
      }

      const wallet = await tx.wallet.findUnique({
        where: { id: transaction.walletId },
        select: { id: true, availableBalance: true },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      const balanceBefore = wallet.availableBalance;
      const balanceAfter = balanceBefore + walletCreditKobo;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { increment: walletCreditKobo },
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
            fundingFeeKobo: chargedFundingFeeKobo.toString(),
            gatewayFeeKobo: chargedFundingFeeKobo.toString(),
            gatewayNetKobo: (amountKobo - chargedFundingFeeKobo).toString(),
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
          message: `Your wallet has been credited with ${formatNaira(walletCreditKobo)}.`,
          metadata: {
            reference: transaction.reference,
            amountKobo: walletCreditKobo.toString(),
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
            amountKobo: walletCreditKobo.toString(),
            fundingFeeKobo: chargedFundingFeeKobo.toString(),
            fundingTotalKobo: amountKobo.toString(),
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
      case PaymentGateway.FLUTTERWAVE:
        return (
          request.headers['verif-hash'] ??
          request.headers['x-flutterwave-signature']
        );
      case PaymentGateway.FINTAVAPAY:
        return request.headers['x-fintava-signature'];
      default:
        return (
          request.headers['x-fintava-signature'] ??
          request.headers['x-webhook-signature']
        );
    }
  }

  private isSuccessfulPaymentEvent(event: string) {
    const normalized = event.toLowerCase();
    return (
      normalized === 'account_funded' ||
      normalized.includes('funded') ||
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
