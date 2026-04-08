import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import {
  RELEASE_ESCROW_JOB_NAME,
  RELEASE_ESCROW_QUEUE_NAME,
} from './release-queue.constants';
import {
  OrdersReleaseQueueService,
  type ReleaseEscrowJobData,
} from './orders-release-queue.service';

@Processor(RELEASE_ESCROW_QUEUE_NAME)
export class OrdersReleaseProcessor {
  constructor(
    private readonly ordersReleaseQueueService: OrdersReleaseQueueService,
  ) {}

  @Process(RELEASE_ESCROW_JOB_NAME)
  async handleReleaseEscrow(job: Job<ReleaseEscrowJobData>) {
    return this.ordersReleaseQueueService.processReleaseEscrow(
      job.data.orderId,
    );
  }
}
