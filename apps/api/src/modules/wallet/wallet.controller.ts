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
import type { JwtUser } from '@zentry/types';
import { UserRole } from '@zentry/types';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
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
  getAdminWalletOverview() {
    return this.walletService.getAdminWalletOverview();
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('admin/cbt-earnings')
  getAdminCbtEarningsOverview() {
    return this.walletService.getAdminCbtEarningsOverview();
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('admin/wallets')
  getAdminWallets(@Query() query: GetAdminWalletsQueryDto) {
    return this.walletService.getAdminWallets(query);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('admin/transactions')
  getAdminTransactions(@Query() query: GetAdminWalletTransactionsQueryDto) {
    return this.walletService.getAdminTransactions(query);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('admin/withdrawals')
  getAdminWithdrawals(@Query() query: GetAdminWithdrawalsQueryDto) {
    return this.walletService.getAdminWithdrawals(query);
  }

  @Roles(UserRole.SUPER_ADMIN)
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
    );
  }

  @Get('me')
  getMyWallet(@CurrentUser() user: JwtUser) {
    return this.walletService.getMyWalletOverview(user.sub);
  }

  @Get('transactions')
  getMyTransactions(
    @CurrentUser() user: JwtUser,
    @Query() query: GetWalletTransactionsQueryDto,
  ) {
    return this.walletService.getMyTransactions(user.sub, query);
  }

  @Roles(UserRole.CBT_CENTER)
  @Get('cbt/earnings')
  getCbtEarnings(
    @CurrentUser() user: JwtUser,
    @Query() query: GetCbtEarningsQueryDto,
  ) {
    return this.walletService.getCbtEarnings(user.sub, query);
  }

  @Roles(UserRole.CBT_CENTER)
  @Get('withdrawals')
  getMyWithdrawals(
    @CurrentUser() user: JwtUser,
    @Query() query: GetMyWithdrawalsQueryDto,
  ) {
    return this.walletService.getMyWithdrawals(user.sub, query);
  }

  @Roles(UserRole.CBT_CENTER)
  @Post('withdrawals')
  createWithdrawalRequest(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateWithdrawalRequestDto,
  ) {
    return this.walletService.createWithdrawalRequest(user.sub, dto);
  }

  @Post('fund')
  initiateFunding(
    @CurrentUser() user: JwtUser,
    @Body() dto: InitiateWalletFundingDto,
  ) {
    return this.walletService.initiateFunding(user.sub, dto);
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
}
