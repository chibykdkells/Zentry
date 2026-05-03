import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  DELIVERY_DEADLINE_QUEUE_NAME,
  DELIVERY_DEADLINE_JOB_NAME,
  buildDeadlineJobId,
} from './delivery-deadline.constants';

@Injectable()
export class OrdersDeadlineQueueService {
  constructor(
    @InjectQueue(DELIVERY_DEADLINE_QUEUE_NAME)
    private readonly deadlineQueue: Queue,
  ) {}

  async scheduleDeadline(orderId: string, deadline: Date) {
    const delay = deadline.getTime() - Date.now();
    if (delay <= 0) return;

    await this.deadlineQueue.add(
      DELIVERY_DEADLINE_JOB_NAME,
      { orderId },
      {
        delay,
        jobId: buildDeadlineJobId(orderId),
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  async cancelDeadline(orderId: string) {
    const job = await this.deadlineQueue.getJob(buildDeadlineJobId(orderId));
    if (job) {
      await job.remove();
    }
  }
}
