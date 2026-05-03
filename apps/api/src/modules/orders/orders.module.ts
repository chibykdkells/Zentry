import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { RELEASE_ESCROW_QUEUE_NAME } from './release-queue.constants';
import { DELIVERY_DEADLINE_QUEUE_NAME } from './delivery-deadline.constants';
import { OrdersReleaseProcessor } from './orders-release.processor';
import { OrdersReleaseQueueService } from './orders-release-queue.service';
import { OrdersUploadJanitorService } from './orders-upload-janitor.service';
import { OrdersDeadlineProcessor } from './orders-deadline.processor';
import { OrdersDeadlineQueueService } from './orders-deadline-queue.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: RELEASE_ESCROW_QUEUE_NAME }),
    BullModule.registerQueue({ name: DELIVERY_DEADLINE_QUEUE_NAME }),
    NotificationsModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersReleaseQueueService,
    OrdersReleaseProcessor,
    OrdersUploadJanitorService,
    OrdersDeadlineQueueService,
    OrdersDeadlineProcessor,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
