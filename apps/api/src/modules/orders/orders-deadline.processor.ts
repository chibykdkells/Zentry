import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderStatus, NotificationType } from '@prisma/client';
import {
  DELIVERY_DEADLINE_QUEUE_NAME,
  DELIVERY_DEADLINE_JOB_NAME,
} from './delivery-deadline.constants';

@Processor(DELIVERY_DEADLINE_QUEUE_NAME)
export class OrdersDeadlineProcessor {
  private readonly logger = new Logger(OrdersDeadlineProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Process(DELIVERY_DEADLINE_JOB_NAME)
  async handleDeadline(job: Job<{ orderId: string }>) {
    const { orderId } = job.data;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        tenantId: true,
        status: true,
        assignedCbtId: true,
        assignedCbt: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        requester: { select: { id: true } },
        service: { select: { name: true } },
      },
    });

    if (!order) return;
    if (
      order.status !== OrderStatus.ASSIGNED &&
      order.status !== OrderStatus.IN_PROGRESS
    ) {
      return;
    }

    const cbtId = order.assignedCbtId;
    if (!cbtId) return;

    this.logger.warn(`Deadline expired for order ${orderId}, returning to pool`);

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PENDING,
          assignedCbtId: null,
          assignedAt: null,
          deliveryDeadline: null,
        },
      });

      await tx.notification.create({
        data: {
          userId: cbtId,
          orderId,
          type: NotificationType.JOB_UNASSIGNED,
          title: 'Job returned to pool',
          message: `Your delivery window for ${order.service.name} expired. The job has been returned to the pool.`,
          metadata: { orderNumber: order.orderNumber },
        },
      });

      if (order.tenantId) {
        const tenantAdmin = await tx.user.findFirst({
          where: { tenantId: order.tenantId, role: 'TENANT_ADMIN' },
          select: { id: true },
        });
        if (tenantAdmin) {
          await tx.notification.create({
            data: {
              userId: tenantAdmin.id,
              orderId,
              type: NotificationType.JOB_UNASSIGNED,
              title: 'CBT missed delivery deadline',
              message: `Order ${order.orderNumber} was returned to the job pool — the assigned CBT center missed the delivery window.`,
              metadata: { orderNumber: order.orderNumber, cbtId },
            },
          });
        }
      }
    });

    if (order.assignedCbt) {
      this.notificationsService.pushNotificationToUser(order.assignedCbt.id, {
        type: 'JOB_UNASSIGNED',
        title: 'Job returned to pool',
        message: `Your delivery window for ${order.service.name} expired.`,
        orderId,
      });
    }
  }
}
