import { Injectable } from '@nestjs/common';
import { Prisma, TransactionType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Revenue over time ────────────────────────────────────────────

  async getRevenueTimeSeries(
    tenantId: string | null,
    period: AnalyticsPeriod,
    limitPoints = 30,
  ) {
    const tf = tenantId
      ? Prisma.sql`AND t."tenantId" = ${tenantId}`
      : Prisma.sql``;
    const trunc =
      period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month';

    // Platform commission + service purchase transactions = platform revenue
    const rows = await this.prisma.$queryRaw<
      Array<{ period: Date; revenue: bigint; order_count: bigint }>
    >`
      SELECT
        date_trunc(${trunc}, t."createdAt") AS period,
        COALESCE(SUM(t.amount), 0)          AS revenue,
        COUNT(*)                            AS order_count
      FROM "Transaction" t
      WHERE t.type IN (${TransactionType.PLATFORM_COMMISSION}, ${TransactionType.SERVICE_PURCHASE})
        AND t.status = 'SUCCESS'
        ${tf}
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT ${limitPoints}
    `;

    return rows.reverse().map((r) => ({
      period: r.period.toISOString(),
      revenue: r.revenue.toString(),
      orderCount: Number(r.order_count),
    }));
  }

  // ── Orders by service type ────────────────────────────────────────

  async getOrdersByService(tenantId: string | null, topN = 10) {
    const tf = tenantId ? { tenantId } : {};

    const rows = await this.prisma.order.groupBy({
      by: ['serviceId'],
      where: tf,
      _count: { id: true },
      _sum: { totalAmount: true },
      orderBy: { _count: { id: 'desc' } },
      take: topN,
    });

    const serviceIds = rows.map((r) => r.serviceId);
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true, category: { select: { name: true } } },
    });

    const serviceMap = new Map(services.map((s) => [s.id, s]));

    return rows.map((r) => ({
      serviceId: r.serviceId,
      serviceName: serviceMap.get(r.serviceId)?.name ?? 'Unknown',
      categoryName: serviceMap.get(r.serviceId)?.category.name ?? 'Unknown',
      orderCount: r._count.id,
      totalRevenue: (r._sum.totalAmount ?? BigInt(0)).toString(),
    }));
  }

  // ── CBT performance ───────────────────────────────────────────────

  async getCbtPerformance(tenantId: string | null) {
    const tf = tenantId ? { tenantId } : {};

    const [totalCompleted, totalDisputed, totalCbts, approvedCbts, topCbts] =
      await Promise.all([
        this.prisma.order.count({
          where: {
            ...tf,
            fulfillmentType: 'MANUAL',
            status: { in: ['COMPLETED', 'REFUNDED'] },
          },
        }),
        this.prisma.order.count({
          where: { ...tf, fulfillmentType: 'MANUAL', dispute: { isNot: null } },
        }),
        this.prisma.cbtProfile.count({ where: tf }),
        this.prisma.cbtProfile.count({
          where: { ...tf, approvalStatus: 'APPROVED' },
        }),
        this.prisma.order.groupBy({
          by: ['assignedCbtId'],
          where: {
            ...tf,
            fulfillmentType: 'MANUAL',
            status: 'COMPLETED',
            assignedCbtId: { not: null },
          },
          _count: { id: true },
          _sum: { cbtCommission: true },
          orderBy: { _count: { id: 'desc' } },
          take: 5,
        }),
      ]);

    const cbtIds = topCbts
      .map((r) => r.assignedCbtId)
      .filter(Boolean) as string[];

    const cbtUsers = await this.prisma.user.findMany({
      where: { id: { in: cbtIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        cbtProfile: { select: { centerName: true } },
      },
    });

    const cbtMap = new Map(cbtUsers.map((u) => [u.id, u]));

    return {
      totalCompleted,
      totalDisputed,
      disputeRate:
        totalCompleted > 0
          ? Number(((totalDisputed / totalCompleted) * 100).toFixed(1))
          : 0,
      totalCbts,
      approvedCbts,
      topPerformers: topCbts.map((r) => ({
        cbtId: r.assignedCbtId,
        name:
          cbtMap.get(r.assignedCbtId!)?.cbtProfile?.centerName ??
          `${cbtMap.get(r.assignedCbtId!)?.firstName ?? ''} ${cbtMap.get(r.assignedCbtId!)?.lastName ?? ''}`.trim(),
        jobsCompleted: r._count.id,
        totalEarned: (r._sum.cbtCommission ?? BigInt(0)).toString(),
      })),
    };
  }

  // ── User growth ───────────────────────────────────────────────────

  async getUserGrowth(
    tenantId: string | null,
    period: AnalyticsPeriod,
    limitPoints = 30,
  ) {
    const tf = tenantId
      ? Prisma.sql`AND "tenantId" = ${tenantId}`
      : Prisma.sql``;
    const trunc =
      period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month';

    const rows = await this.prisma.$queryRaw<
      Array<{ period: Date; new_users: bigint }>
    >`
      SELECT
        date_trunc(${trunc}, "createdAt") AS period,
        COUNT(*)                          AS new_users
      FROM "User"
      WHERE role NOT IN (${UserRole.SUPER_ADMIN})
        ${tf}
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT ${limitPoints}
    `;

    const sorted = rows.reverse();
    let cumulative = 0;
    return sorted.map((r) => {
      cumulative += Number(r.new_users);
      return {
        period: r.period.toISOString(),
        newUsers: Number(r.new_users),
        cumulative,
      };
    });
  }

  // ── Wallet float overview ─────────────────────────────────────────

  async getWalletFloat(tenantId: string | null) {
    const tf = tenantId ? { tenantId } : {};

    const [escrowAgg, platformWallet, cbtAgg, userAgg] = await Promise.all([
      // Total funds currently in escrow (requester-held)
      this.prisma.wallet.aggregate({
        where: {
          user: {
            ...tf,
            role: { in: [UserRole.INDIVIDUAL] },
          },
        },
        _sum: { escrowBalance: true },
      }),
      // Platform wallet balance
      this.prisma.wallet.findFirst({
        where: { user: { role: UserRole.SUPER_ADMIN } },
        select: { availableBalance: true },
      }),
      // Total CBT available balance
      this.prisma.wallet.aggregate({
        where: { user: { ...tf, role: UserRole.CBT_CENTER } },
        _sum: { availableBalance: true },
      }),
      // Total user wallet balances
      this.prisma.wallet.aggregate({
        where: {
          user: {
            ...tf,
            role: { in: [UserRole.INDIVIDUAL] },
          },
        },
        _sum: { availableBalance: true },
      }),
    ]);

    return {
      totalEscrowed: (escrowAgg._sum.escrowBalance ?? BigInt(0)).toString(),
      platformBalance: (
        platformWallet?.availableBalance ?? BigInt(0)
      ).toString(),
      totalCbtAvailable: (cbtAgg._sum.availableBalance ?? BigInt(0)).toString(),
      totalUserAvailable: (
        userAgg._sum.availableBalance ?? BigInt(0)
      ).toString(),
    };
  }

  // ── Full overview (all metrics in one call) ───────────────────────

  async getAdminOverview(tenantId: string | null) {
    const [revenue, ordersByService, cbtPerformance, userGrowth, walletFloat] =
      await Promise.all([
        this.getRevenueTimeSeries(tenantId, 'daily', 30),
        this.getOrdersByService(tenantId, 10),
        this.getCbtPerformance(tenantId),
        this.getUserGrowth(tenantId, 'daily', 30),
        this.getWalletFloat(tenantId),
      ]);

    return {
      revenue,
      ordersByService,
      cbtPerformance,
      userGrowth,
      walletFloat,
    };
  }

  // ── CSV export ────────────────────────────────────────────────────

  async exportOrdersCsv(tenantId: string | null): Promise<string> {
    const tf = tenantId ? { tenantId } : {};

    const orders = await this.prisma.order.findMany({
      where: tf,
      orderBy: { createdAt: 'desc' },
      take: 10000,
      select: {
        orderNumber: true,
        status: true,
        fulfillmentType: true,
        totalAmount: true,
        platformFee: true,
        cbtCommission: true,
        escrowReleasedAt: true,
        createdAt: true,
        service: {
          select: { name: true, category: { select: { name: true } } },
        },
        requester: { select: { email: true } },
        assignedCbt: { select: { email: true } },
      },
    });

    const headers = [
      'Order Number',
      'Status',
      'Fulfillment Type',
      'Service',
      'Category',
      'Requester',
      'Assigned CBT',
      'Total (Kobo)',
      'Platform Fee (Kobo)',
      'CBT Commission (Kobo)',
      'Escrow Released',
      'Created At',
    ].join(',');

    const rows = orders.map((o) =>
      [
        o.orderNumber,
        o.status,
        o.fulfillmentType,
        `"${o.service.name.replace(/"/g, '""')}"`,
        `"${o.service.category.name.replace(/"/g, '""')}"`,
        o.requester.email,
        o.assignedCbt?.email ?? '',
        o.totalAmount.toString(),
        o.platformFee.toString(),
        o.cbtCommission.toString(),
        o.escrowReleasedAt ? o.escrowReleasedAt.toISOString() : '',
        o.createdAt.toISOString(),
      ].join(','),
    );

    return [headers, ...rows].join('\n');
  }

  async exportTransactionsCsv(tenantId: string | null): Promise<string> {
    const tf = tenantId ? { user: { tenantId } } : {};

    const txns = await this.prisma.transaction.findMany({
      where: tf,
      orderBy: { createdAt: 'desc' },
      take: 10000,
      select: {
        reference: true,
        type: true,
        status: true,
        amount: true,
        balanceBefore: true,
        balanceAfter: true,
        description: true,
        createdAt: true,
        user: { select: { email: true, role: true } },
      },
    });

    const headers = [
      'Reference',
      'Type',
      'Status',
      'Amount (Kobo)',
      'Balance Before (Kobo)',
      'Balance After (Kobo)',
      'User Email',
      'User Role',
      'Description',
      'Created At',
    ].join(',');

    const rows = txns.map((t) =>
      [
        t.reference,
        t.type,
        t.status,
        t.amount.toString(),
        t.balanceBefore.toString(),
        t.balanceAfter.toString(),
        t.user.email,
        t.user.role,
        `"${(t.description ?? '').replace(/"/g, '""')}"`,
        t.createdAt.toISOString(),
      ].join(','),
    );

    return [headers, ...rows].join('\n');
  }
}
