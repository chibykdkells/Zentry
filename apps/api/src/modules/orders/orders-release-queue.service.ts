import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import {
  DisputeStatus,
  NotificationType,
  OrderStatus,
  TransactionStatus,
  TransactionType,
  UserRole,
} from '@prisma/client';
import { Queue } from 'bull';
import { generateTransactionRef } from '@zendocx/utils';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  buildReleaseEscrowJobId,
  RELEASE_ESCROW_JOB_NAME,
  RELEASE_ESCROW_QUEUE_NAME,
} from './release-queue.constants';

export interface ReleaseEscrowJobData {
  orderId: string;
  orderNumber: string;
}

@Injectable()
export class OrdersReleaseQueueService implements OnModuleInit {
  private readonly logger = new Logger(OrdersReleaseQueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(RELEASE_ESCROW_QUEUE_NAME)
    private readonly releaseQueue: Queue<ReleaseEscrowJobData>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    try {
      await this.schedulePendingReleaseJobs();
    } catch (error) {
      this.logger.error(
        `Skipping release scheduler warm-up during bootstrap: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  async scheduleReleaseForOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        fulfillmentType: true,
        disputeWindowExpiresAt: true,
        escrowReleasedAt: true,
        assignedCbtId: true,
        dispute: {
          select: { id: true, status: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const validation = this.getReleaseSchedulingValidation(order);

    if (validation.blockedReasons.length) {
      this.logger.warn(
        `Skipping release scheduling for ${order.orderNumber}: ${validation.blockedReasons.join(' | ')}`,
      );

      return {
        scheduled: false,
        blockedReasons: validation.blockedReasons,
      };
    }

    await this.releaseQueue.add(
      RELEASE_ESCROW_JOB_NAME,
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
      },
      {
        jobId: buildReleaseEscrowJobId(order.id),
        delay: validation.delayMs,
        attempts: 3,
        backoff: {
          type: 'fixed',
          delay: 30000,
        },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );

    return {
      scheduled: true,
      scheduledFor: validation.scheduledFor,
      delayMs: validation.delayMs,
      jobId: buildReleaseEscrowJobId(order.id),
    };
  }

  async schedulePendingReleaseJobs() {
    const orders = await this.prisma.order.findMany({
      where: {
        fulfillmentType: 'MANUAL',
        status: OrderStatus.COMPLETED,
        escrowReleasedAt: null,
      },
      orderBy: { disputeWindowExpiresAt: 'asc' },
      select: {
        id: true,
        orderNumber: true,
      },
    });

    for (const order of orders) {
      try {
        await this.scheduleReleaseForOrder(order.id);
      } catch (error) {
        this.logger.error(
          `Could not schedule release job for ${order.orderNumber}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    }
  }

  async removeScheduledReleaseForOrder(orderId: string) {
    const jobId = buildReleaseEscrowJobId(orderId);
    const job = await this.releaseQueue.getJob(jobId);

    if (!job) {
      return {
        removed: false,
        reason: 'not_found',
        jobId,
      };
    }

    await job.remove();

    return {
      removed: true,
      jobId,
    };
  }

  async processReleaseEscrow(orderId: string) {
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          fulfillmentType: true,
          totalAmount: true,
          platformFee: true,
          cbtCommission: true,
          escrowReleasedAt: true,
          disputeWindowExpiresAt: true,
          assignedCbtId: true,
          assignedCbt: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              cbtStaffProfile: {
                select: { cbtId: true },
              },
              wallet: {
                select: {
                  id: true,
                  availableBalance: true,
                  totalEarned: true,
                },
              },
            },
          },
          requester: {
            select: {
              id: true,
              email: true,
              wallet: {
                select: {
                  id: true,
                  escrowBalance: true,
                },
              },
            },
          },
          dispute: {
            select: {
              id: true,
              status: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const blockedReasons = this.getReleaseExecutionBlockedReasons(order, now);

      if (order.escrowReleasedAt) {
        return {
          released: false,
          skipped: true,
          reason: 'already_released',
          orderNumber: order.orderNumber,
          blockedReasons: [],
        };
      }

      if (blockedReasons.length) {
        await tx.auditLog.create({
          data: {
            action: 'ORDER_ESCROW_RELEASE_SKIPPED',
            entity: 'Order',
            entityId: order.id,
            newValues: {
              orderNumber: order.orderNumber,
              blockedReasons,
            },
          },
        });

        return {
          released: false,
          skipped: true,
          reason: 'blocked',
          orderNumber: order.orderNumber,
          blockedReasons,
        };
      }

      if (!order.requester.wallet) {
        throw new ConflictException('Requester wallet not found');
      }

      // Commission recipient: if the fulfiller is CBT_STAFF, credit the parent
      // CBT center's wallet. The staff earns on behalf of the center.
      let earnerUserId: string;
      let earnerWallet: { id: string; availableBalance: bigint; totalEarned: bigint };

      if (
        order.assignedCbt?.role === UserRole.CBT_STAFF &&
        order.assignedCbt.cbtStaffProfile?.cbtId
      ) {
        const parentWallet = await tx.wallet.findUnique({
          where: { userId: order.assignedCbt.cbtStaffProfile.cbtId },
          select: { id: true, availableBalance: true, totalEarned: true },
        });
        if (!parentWallet) {
          throw new ConflictException('Parent CBT center wallet not found');
        }
        earnerUserId = order.assignedCbt.cbtStaffProfile.cbtId;
        earnerWallet = parentWallet;
      } else {
        if (!order.assignedCbt?.wallet) {
          throw new ConflictException('Assigned CBT wallet not found');
        }
        earnerUserId = order.assignedCbt.id;
        earnerWallet = order.assignedCbt.wallet;
      }

      const platformWallet = await tx.wallet.findFirst({
        where: {
          user: {
            role: UserRole.SUPER_ADMIN,
          },
        },
        select: {
          id: true,
          userId: true,
          availableBalance: true,
        },
      });

      if (!platformWallet) {
        throw new ConflictException('Platform wallet not found');
      }

      if (order.requester.wallet.escrowBalance < order.totalAmount) {
        throw new ConflictException(
          'Requester escrow balance is lower than the order total.',
        );
      }

      const requesterEscrowBefore = order.requester.wallet.escrowBalance;
      const requesterEscrowAfter = requesterEscrowBefore - order.totalAmount;
      const cbtBalanceBefore = earnerWallet.availableBalance;
      const cbtBalanceAfter = cbtBalanceBefore + order.cbtCommission;
      const cbtTotalEarnedAfter = earnerWallet.totalEarned + order.cbtCommission;
      const platformNet = order.totalAmount - order.cbtCommission;
      const platformBalanceBefore = platformWallet.availableBalance;
      const platformBalanceAfter = platformBalanceBefore + platformNet;
      const requesterReleaseReference = generateTransactionRef();
      const cbtCommissionReference = generateTransactionRef();
      const platformCommissionReference = generateTransactionRef();

      await tx.wallet.update({
        where: { id: order.requester.wallet.id },
        data: {
          escrowBalance: requesterEscrowAfter,
        },
      });

      await tx.wallet.update({
        where: { id: earnerWallet.id },
        data: {
          availableBalance: cbtBalanceAfter,
          totalEarned: cbtTotalEarnedAfter,
        },
      });

      await tx.wallet.update({
        where: { id: platformWallet.id },
        data: {
          availableBalance: platformBalanceAfter,
        },
      });

      await tx.transaction.createMany({
        data: [
          {
            walletId: order.requester.wallet.id,
            userId: order.requester.id,
            orderId: order.id,
            type: TransactionType.ESCROW_RELEASE,
            status: TransactionStatus.SUCCESS,
            amount: order.totalAmount,
            balanceBefore: requesterEscrowBefore,
            balanceAfter: requesterEscrowAfter,
            reference: requesterReleaseReference,
            description: `Escrow released for ${order.service.name}`,
            metadata: {
              orderNumber: order.orderNumber,
              scope: 'escrow-release',
            },
          },
          {
            walletId: earnerWallet.id,
            userId: earnerUserId,
            orderId: order.id,
            type: TransactionType.CBT_COMMISSION,
            status: TransactionStatus.SUCCESS,
            amount: order.cbtCommission,
            balanceBefore: cbtBalanceBefore,
            balanceAfter: cbtBalanceAfter,
            reference: cbtCommissionReference,
            description: `CBT commission credited for ${order.orderNumber}`,
            metadata: {
              orderNumber: order.orderNumber,
              scope: 'cbt-commission',
              ...(order.assignedCbt?.role === UserRole.CBT_STAFF
                ? { fulfilledByStaffId: order.assignedCbt.id }
                : {}),
            },
          },
          {
            walletId: platformWallet.id,
            userId: platformWallet.userId,
            orderId: order.id,
            type: TransactionType.PLATFORM_COMMISSION,
            status: TransactionStatus.SUCCESS,
            amount: platformNet,
            balanceBefore: platformBalanceBefore,
            balanceAfter: platformBalanceAfter,
            reference: platformCommissionReference,
            description: `Platform commission retained for ${order.orderNumber}`,
            metadata: {
              orderNumber: order.orderNumber,
              scope: 'platform-commission',
            },
          },
        ],
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          escrowReleasedAt: now,
        },
      });

      await tx.notification.createMany({
        data: [
          {
            userId: earnerUserId,
            orderId: order.id,
            type: NotificationType.ORDER_COMPLETED,
            title: 'Earnings are now available',
            message: `${order.orderNumber} has cleared the dispute window and earnings are now in your wallet.`,
            metadata: {
              orderNumber: order.orderNumber,
              cbtCommission: order.cbtCommission.toString(),
            },
          },
          {
            userId: order.requester.id,
            orderId: order.id,
            type: NotificationType.ORDER_COMPLETED,
            title: 'Order finalized successfully',
            message: `${order.service.name} has been finalized and escrow has been released.`,
            metadata: {
              orderNumber: order.orderNumber,
            },
          },
        ],
      });

      await tx.auditLog.create({
        data: {
          action: 'ORDER_ESCROW_RELEASED',
          entity: 'Order',
          entityId: order.id,
          oldValues: {
            escrowReleasedAt: null,
          },
          newValues: {
            orderNumber: order.orderNumber,
            escrowReleasedAt: now.toISOString(),
            requesterReleaseReference,
            cbtCommissionReference,
            platformCommissionReference,
          },
        },
      });

      return {
        released: true,
        skipped: false,
        orderNumber: order.orderNumber,
        cbtCommission: order.cbtCommission.toString(),
        platformNet: platformNet.toString(),
        cbtId: earnerUserId,
      };
    });

    if (result.skipped) {
      this.logger.warn(
        `Release job for ${result.orderNumber} skipped: ${
          result.reason ?? 'unknown'
        } ${
          result.blockedReasons?.length
            ? `(${result.blockedReasons.join(' | ')})`
            : ''
        }`,
      );
      return result;
    }

    // Real-time: notify CBT their earnings landed
    if (result.cbtId) {
      this.notificationsService.broadcastWalletUpdated(result.cbtId);
    }

    this.logger.log(`Escrow released successfully for ${result.orderNumber}`);
    return result;
  }

  private getReleaseSchedulingValidation(order: {
    orderNumber: string;
    status: OrderStatus;
    fulfillmentType: string;
    disputeWindowExpiresAt: Date | null;
    escrowReleasedAt: Date | null;
    assignedCbtId: string | null;
    dispute: { id: string; status: DisputeStatus } | null;
  }) {
    const now = new Date();
    const blockedReasons: string[] = [];

    if (order.fulfillmentType !== 'MANUAL') {
      blockedReasons.push('Only manual orders use delayed escrow release.');
    }

    if (order.status !== OrderStatus.COMPLETED) {
      blockedReasons.push(
        'Only completed orders can be scheduled for release.',
      );
    }

    if (!order.assignedCbtId) {
      blockedReasons.push(
        'A CBT must be assigned before release can be queued.',
      );
    }

    if (!order.disputeWindowExpiresAt) {
      blockedReasons.push('Dispute window expiry is missing on this order.');
    }

    if (order.dispute && this.isReleaseBlockingDispute(order.dispute.status)) {
      blockedReasons.push('An open dispute is attached to this order.');
    }

    if (order.escrowReleasedAt) {
      blockedReasons.push('Escrow has already been released for this order.');
    }

    const scheduledFor = order.disputeWindowExpiresAt ?? now;
    const delayMs = Math.max(0, scheduledFor.getTime() - now.getTime());

    return {
      scheduledFor,
      delayMs,
      blockedReasons,
    };
  }

  private getReleaseExecutionBlockedReasons(
    order: {
      status: OrderStatus;
      fulfillmentType: string;
      disputeWindowExpiresAt: Date | null;
      escrowReleasedAt: Date | null;
      assignedCbtId: string | null;
      dispute: { id: string; status: DisputeStatus } | null;
    },
    now = new Date(),
  ) {
    const blockedReasons: string[] = [];

    if (order.fulfillmentType !== 'MANUAL') {
      blockedReasons.push(
        'Only manual orders can pass through delayed release.',
      );
    }

    if (order.status !== OrderStatus.COMPLETED) {
      blockedReasons.push('Order is not completed.');
    }

    if (!order.assignedCbtId) {
      blockedReasons.push('Assigned CBT is missing.');
    }

    if (!order.disputeWindowExpiresAt) {
      blockedReasons.push('Dispute window expiry is missing.');
    }

    if (order.dispute && this.isReleaseBlockingDispute(order.dispute.status)) {
      blockedReasons.push(
        'A dispute is attached to this order, so release must wait for dispute handling.',
      );
    }

    if (
      order.disputeWindowExpiresAt &&
      order.disputeWindowExpiresAt.getTime() > now.getTime()
    ) {
      blockedReasons.push('The dispute window is still active.');
    }

    if (order.escrowReleasedAt) {
      blockedReasons.push('Escrow has already been released.');
    }

    return blockedReasons;
  }

  private isReleaseBlockingDispute(status: DisputeStatus) {
    return status !== DisputeStatus.RESOLVED_FOR_CBT;
  }
}
