import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WalletService } from './wallet.service';

/**
 * Drives the abandoned-funding sweep on a timer.
 *
 * Every six hours, not more often: when the app is otherwise idle this cron is
 * the only thing that wakes the database, and a Neon compute stays up for
 * minutes after any query. Nothing depends on a funding attempt being written
 * off promptly — it has already been unpaid for at least a day by the time the
 * sweep considers it.
 */
@Injectable()
export class WalletFundingJanitorService {
  private readonly logger = new Logger(WalletFundingJanitorService.name);

  constructor(private readonly walletService: WalletService) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async sweepAbandonedFundings() {
    try {
      return await this.walletService.sweepAbandonedFundings();
    } catch (error) {
      // Never throw from a cron: an unhandled rejection would take the process
      // down over housekeeping.
      this.logger.error(
        `Abandoned funding sweep failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );

      return null;
    }
  }
}
