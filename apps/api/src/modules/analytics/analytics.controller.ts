import { Controller, Get, Query, Res } from '@nestjs/common';
import { UserRole, type JwtUser } from '@zentry/types';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnalyticsService, type AnalyticsPeriod } from './analytics.service';

const VALID_PERIODS: AnalyticsPeriod[] = ['daily', 'weekly', 'monthly'];

function parsePeriod(raw: string | undefined): AnalyticsPeriod {
  return VALID_PERIODS.includes(raw as AnalyticsPeriod)
    ? (raw as AnalyticsPeriod)
    : 'daily';
}

@Controller('analytics')
@Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('admin/overview')
  getOverview(@CurrentUser() user: JwtUser) {
    return this.analyticsService.getAdminOverview(user.tenantId ?? null);
  }

  @Get('admin/revenue')
  getRevenue(
    @CurrentUser() user: JwtUser,
    @Query('period') period?: string,
    @Query('points') points?: string,
  ) {
    return this.analyticsService.getRevenueTimeSeries(
      user.tenantId ?? null,
      parsePeriod(period),
      points ? Math.min(90, parseInt(points, 10)) : 30,
    );
  }

  @Get('admin/orders-by-service')
  getOrdersByService(@CurrentUser() user: JwtUser, @Query('top') top?: string) {
    return this.analyticsService.getOrdersByService(
      user.tenantId ?? null,
      top ? Math.min(20, parseInt(top, 10)) : 10,
    );
  }

  @Get('admin/cbt-performance')
  getCbtPerformance(@CurrentUser() user: JwtUser) {
    return this.analyticsService.getCbtPerformance(user.tenantId ?? null);
  }

  @Get('admin/user-growth')
  getUserGrowth(
    @CurrentUser() user: JwtUser,
    @Query('period') period?: string,
    @Query('points') points?: string,
  ) {
    return this.analyticsService.getUserGrowth(
      user.tenantId ?? null,
      parsePeriod(period),
      points ? Math.min(90, parseInt(points, 10)) : 30,
    );
  }

  @Get('admin/wallet-float')
  getWalletFloat(@CurrentUser() user: JwtUser) {
    return this.analyticsService.getWalletFloat(user.tenantId ?? null);
  }

  @Get('admin/export/orders')
  async exportOrders(@CurrentUser() user: JwtUser, @Res() res: Response) {
    const csv = await this.analyticsService.exportOrdersCsv(
      user.tenantId ?? null,
    );
    const filename = `zentry-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(csv);
  }

  @Get('admin/export/transactions')
  async exportTransactions(@CurrentUser() user: JwtUser, @Res() res: Response) {
    const csv = await this.analyticsService.exportTransactionsCsv(
      user.tenantId ?? null,
    );
    const filename = `zentry-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(csv);
  }
}
