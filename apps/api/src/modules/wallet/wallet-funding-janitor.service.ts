import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WalletService } from './wallet.service';

/**
 * Scheduled trigger for the abandoned-funding sweep.
 *
 * Treat this as a bonus rather than the mechanism. The API machine suspends when
 * idle, so a six-hourly slot usually arrives while this process is not running,
 * and @nestjs/schedule does not replay a slot it missed — on a quiet platform
 * this cron may fire rarely or never. The sweep is kept honest by
 * `maybeSweepAbandonedFundings`, which rides on wallet requests, and by the
 * admin endpoint for running one on demand.
 *
 * It goes through the same throttle as those, so the three paths cannot overlap
 * or double-run.
 */
@Injectable()
export class WalletFundingJanitorService {
  constructor(private readonly walletService: WalletService) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  sweepAbandonedFundings() {
    this.walletService.maybeSweepAbandonedFundings();
  }
}
