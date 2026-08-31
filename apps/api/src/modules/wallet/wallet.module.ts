import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { WalletController } from './wallet.controller';
import { WalletFundingJanitorService } from './wallet-funding-janitor.service';
import { WalletService } from './wallet.service';

@Module({
  imports: [NotificationsModule],
  controllers: [WalletController],
  providers: [WalletService, WalletFundingJanitorService],
  exports: [WalletService],
})
export class WalletModule {}
