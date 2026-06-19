import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { JwtUser } from '@zendocx/types';
import { UserRole } from '@zendocx/types';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  ApplyAdminFundingReconciliationDto,
  GetAdminFundingReconciliationPreviewDto,
  ConfirmWalletFundingDto,
  CreateWithdrawalRequestDto,
  GetAdminWithdrawalsQueryDto,
  GetCbtEarningsQueryDto,
  GetAdminWalletsQueryDto,
  GetAdminWalletTransactionsQueryDto,
  GetMyWithdrawalsQueryDto,
  GetWalletTransactionsQueryDto,
  InitiateWalletFundingDto,
  ReviewWithdrawalRequestDto,
} from './dto';
import { WalletService } from './wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Roles(UserRole.SUPER_ADMIN)
  @Get('admin/overview')
  getAdminWalletOverview(@CurrentUser() user: JwtUser) {
    return this.walletService.getAdminWalletOverview(user.tenantId);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('admin/cbt-earnings')
  getAdminCbtEarningsOverview(@CurrentUser() user: JwtUser) {
    return this.walletService.getAdminCbtEarningsOverview(user.tenantId);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('admin/wallets')
  getAdminWallets(
    @Query() query: GetAdminWalletsQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.walletService.getAdminWallets(query, user.tenantId);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('admin/transactions')
  getAdminTransactions(
    @Query() query: GetAdminWalletTransactionsQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.walletService.getAdminTransactions(query, user.tenantId);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('admin/funding-reconciliation')
  getAdminFundingReconciliationPreview(
    @Query() query: GetAdminFundingReconciliationPreviewDto,
  ) {
    return this.walletService.getAdminFundingReconciliationPreview(
      query.reference,
    );
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Post('admin/funding-reconciliation')
  applyAdminFundingReconciliation(
    @CurrentUser() user: JwtUser,
    @Body() dto: ApplyAdminFundingReconciliationDto,
  ) {
    return this.walletService.applyAdminFundingReconciliation(
      dto.reference,
      user.sub,
    );
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @Get('admin/withdrawals')
  getAdminWithdrawals(
    @Query() query: GetAdminWithdrawalsQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.walletService.getAdminWithdrawals(query, user.tenantId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @Patch('admin/withdrawals/:withdrawalRequestId')
  reviewWithdrawalRequest(
    @CurrentUser() user: JwtUser,
    @Param('withdrawalRequestId') withdrawalRequestId: string,
    @Body() dto: ReviewWithdrawalRequestDto,
  ) {
    return this.walletService.reviewWithdrawalRequest(
      user.sub,
      withdrawalRequestId,
      dto,
      user.tenantId,
    );
  }

  @Get('me')
  getMyWallet(@CurrentUser() user: JwtUser) {
    return this.walletService.getMyWalletOverview(user.sub, user.tenantId);
  }

  @Get('transactions')
  getMyTransactions(
    @CurrentUser() user: JwtUser,
    @Query() query: GetWalletTransactionsQueryDto,
  ) {
    return this.walletService.getMyTransactions(user.sub, query, user.tenantId);
  }

  @Roles(UserRole.CBT_CENTER)
  @Get('cbt/earnings')
  getCbtEarnings(
    @CurrentUser() user: JwtUser,
    @Query() query: GetCbtEarningsQueryDto,
  ) {
    return this.walletService.getCbtEarnings(user.sub, query, user.tenantId);
  }

  @Roles(UserRole.CBT_CENTER, UserRole.TENANT_ADMIN, UserRole.SUPER_ADMIN)
  @Get('withdrawals')
  getMyWithdrawals(
    @CurrentUser() user: JwtUser,
    @Query() query: GetMyWithdrawalsQueryDto,
  ) {
    return this.walletService.getMyWithdrawals(user.sub, query, user.tenantId);
  }

  @Roles(UserRole.CBT_CENTER, UserRole.TENANT_ADMIN, UserRole.SUPER_ADMIN)
  @Get('banks')
  getBanks() {
    return this.walletService.getBanks();
  }

  @Roles(UserRole.CBT_CENTER, UserRole.TENANT_ADMIN, UserRole.SUPER_ADMIN)
  @Post('withdrawals')
  createWithdrawalRequest(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateWithdrawalRequestDto,
  ) {
    return this.walletService.createWithdrawalRequest(
      user.sub,
      dto,
      user.tenantId,
    );
  }

  @Post('fund')
  initiateFunding(
    @Req() request: Request,
    @CurrentUser() user: JwtUser,
    @Body() dto: InitiateWalletFundingDto,
  ) {
    return this.walletService.initiateFunding(
      user.sub,
      dto,
      request.headers.origin ?? null,
    );
  }

  @Post('fund/confirm')
  @HttpCode(HttpStatus.OK)
  confirmFunding(
    @CurrentUser() user: JwtUser,
    @Body() dto: ConfirmWalletFundingDto,
  ) {
    return this.walletService.confirmFundingReference(dto.reference, user.sub);
  }

  @Public()
  @Post('webhooks/payment')
  @HttpCode(HttpStatus.OK)
  handlePaymentWebhook(@Req() request: Request & { rawBody?: Buffer }) {
    return this.walletService.handlePaymentWebhook(request);
  }

  @Public()
  @Post('webhooks/payout')
  @HttpCode(HttpStatus.OK)
  handlePayoutWebhook(@Req() request: Request & { rawBody?: Buffer }) {
    return this.walletService.handlePayoutWebhook(request);
  }
}
