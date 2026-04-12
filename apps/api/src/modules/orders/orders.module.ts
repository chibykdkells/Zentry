import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { RELEASE_ESCROW_QUEUE_NAME } from './release-queue.constants';
import { OrdersReleaseProcessor } from './orders-release.processor';
import { OrdersReleaseQueueService } from './orders-release-queue.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: RELEASE_ESCROW_QUEUE_NAME,
    }),
    NotificationsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersReleaseQueueService, OrdersReleaseProcessor],
  exports: [OrdersService],
})
export class OrdersModule {}
