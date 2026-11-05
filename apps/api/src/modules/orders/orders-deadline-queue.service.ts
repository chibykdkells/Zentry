import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { OrderStatus } from '@prisma/client';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import {
  DELIVERY_DEADLINE_QUEUE_NAME,
  DELIVERY_DEADLINE_JOB_NAME,
  buildDeadlineJobId,
} from './delivery-deadline.constants';

@Injectable()
export class OrdersDeadlineQueueService implements OnModuleInit {
  private readonly logger = new Logger(OrdersDeadlineQueueService.name);

  constructor(
    @InjectQueue(DELIVERY_DEADLINE_QUEUE_NAME)
    private readonly deadlineQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Delivery-deadline timers live only in Redis. If Redis is replaced or
   * emptied (a server move, a restore), every claimed order would lose its
   * timer and stay with a CBT forever. The order row is the record of truth
   * (`deliveryDeadline`), so rebuild the timers from it on every start, the
   * same way escrow release does. Job IDs are per order, so re-adding a timer
   * that already exists does nothing.
   */
  async onModuleInit() {
    try {
      await this.schedulePendingDeadlines();
    } catch (error) {
      this.logger.error(
        `Skipping delivery-deadline warm-up during bootstrap: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  async schedulePendingDeadlines() {
    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.ASSIGNED, OrderStatus.IN_PROGRESS] },
        assignedCbtId: { not: null },
        deliveryDeadline: { not: null },
      },
      select: { id: true, deliveryDeadline: true },
    });

    let overdue = 0;
    for (const order of orders) {
      if (!order.deliveryDeadline) continue;
      try {
        // An overdue timer fires now: the processor re-checks the order's
        // status before returning it to the pool, so this is safe to repeat.
        const delay = Math.max(0, order.deliveryDeadline.getTime() - Date.now());
        if (delay === 0) overdue += 1;
        await this.addDeadlineJob(order.id, delay);
      } catch (error) {
        this.logger.error(
          `Could not schedule delivery deadline for order ${order.id}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    }

    if (orders.length) {
      this.logger.warn(
        `Delivery-deadline warm-up: ${orders.length} claimed order(s) checked, ${overdue} already overdue`,
      );
    }

    return { checked: orders.length, overdue };
  }

  async scheduleDeadline(orderId: string, deadline: Date) {
    const delay = deadline.getTime() - Date.now();
    if (delay <= 0) return;

    await this.addDeadlineJob(orderId, delay);
  }

  async cancelDeadline(orderId: string) {
    const job = await this.deadlineQueue.getJob(buildDeadlineJobId(orderId));
    if (job) {
      await job.remove();
    }
  }

  private async addDeadlineJob(orderId: string, delay: number) {
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
}
