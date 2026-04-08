import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CbtApprovalStatus,
  DisputeStatus,
  NotificationType,
  OrderStatus,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import { generateOrderNumber, generateTransactionRef } from '@zentry/utils';
import { StorageService } from '../../providers/storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersReleaseQueueService } from './orders-release-queue.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CompleteCbtJobDto } from './dto/complete-cbt-job.dto';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { GetAdminDisputesQueryDto } from './dto/get-admin-disputes.dto';
import { AdminOrderReleasePreviewData } from './dto/get-admin-order-release-preview.dto';
import { AdminReleaseSchedulerPreviewData } from './dto/get-admin-release-scheduler-preview.dto';
import {
  AdminOrderReleaseState,
  GetAdminOrdersQueryDto,
} from './dto/get-admin-orders.dto';
import { GetCbtJobPoolQueryDto } from './dto/get-cbt-job-pool.dto';
import { GetCbtMyJobsQueryDto } from './dto/get-cbt-my-jobs.dto';
import { GetMyDisputesQueryDto } from './dto/get-my-disputes.dto';
import {
  buildReleaseEscrowJobId,
  RELEASE_ESCROW_JOB_NAME,
  RELEASE_ESCROW_QUEUE_NAME,
} from './release-queue.constants';
import { AdminDisputeAction, ReviewDisputeDto } from './dto/review-dispute.dto';
import { UpdateAdminOrderNotesDto } from './dto/update-admin-order-notes.dto';

type RequiredFieldDefinition = {
  name: string;
  label?: string;
  type?: string;
  required?: boolean;
};

type RequiredDocumentDefinition = {
  name: string;
  label?: string;
  required?: boolean;
  acceptedTypes?: string[];
  description?: string;
};

export type UploadedDocumentFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

const orderListSelect = Prisma.validator<Prisma.OrderSelect>()({
  id: true,
  orderNumber: true,
  status: true,
  deliveryMode: true,
  fulfillmentType: true,
  totalAmount: true,
  platformFee: true,
  cbtCommission: true,
  submittedData: true,
  requesterDocUrls: true,
  resultFileUrl: true,
  resultUploadedAt: true,
  escrowReleasedAt: true,
  disputeWindowExpiresAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  service: {
    select: {
      id: true,
      name: true,
      slug: true,
      category: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  },
});

const adminOrderListSelect = Prisma.validator<Prisma.OrderSelect>()({
  ...orderListSelect,
  requester: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
    },
  },
  assignedCbt: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
});

const orderDetailSelect = Prisma.validator<Prisma.OrderSelect>()({
  id: true,
  orderNumber: true,
  status: true,
  deliveryMode: true,
  fulfillmentType: true,
  submittedData: true,
  requesterDocUrls: true,
  resultFileUrl: true,
  resultUploadedAt: true,
  totalAmount: true,
  platformFee: true,
  cbtCommission: true,
  escrowReleasedAt: true,
  disputeWindowExpiresAt: true,
  assignedAt: true,
  completedAt: true,
  providerReference: true,
  providerResponse: true,
  cbtNotes: true,
  adminNotes: true,
  createdAt: true,
  updatedAt: true,
  service: {
    select: {
      id: true,
      name: true,
      slug: true,
      deliveryMode: true,
      fulfillmentType: true,
      requiredFields: true,
      requiredDocuments: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  },
  requester: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
    },
  },
  assignedCbt: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      cbtProfile: {
        select: {
          centerName: true,
          approvalStatus: true,
        },
      },
    },
  },
  transactions: {
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      status: true,
      amount: true,
      description: true,
      reference: true,
      createdAt: true,
    },
  },
  dispute: {
    select: {
      id: true,
      status: true,
      reason: true,
      createdAt: true,
      updatedAt: true,
      resolvedAt: true,
      redoDeadline: true,
      redoCompletedAt: true,
      resolutionNote: true,
      evidenceUrls: true,
    },
  },
});

const myDisputeListSelect = Prisma.validator<Prisma.DisputeSelect>()({
  id: true,
  status: true,
  reason: true,
  evidenceUrls: true,
  resolutionNote: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  redoDeadline: true,
  redoCompletedAt: true,
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      deliveryMode: true,
      fulfillmentType: true,
      resultFileUrl: true,
      disputeWindowExpiresAt: true,
      completedAt: true,
      createdAt: true,
      service: {
        select: {
          id: true,
          name: true,
          slug: true,
          category: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  },
});

const adminDisputeListSelect = Prisma.validator<Prisma.DisputeSelect>()({
  id: true,
  status: true,
  reason: true,
  evidenceUrls: true,
  resolutionNote: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  redoDeadline: true,
  redoCompletedAt: true,
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      deliveryMode: true,
      fulfillmentType: true,
      totalAmount: true,
      platformFee: true,
      cbtCommission: true,
      resultFileUrl: true,
      escrowReleasedAt: true,
      disputeWindowExpiresAt: true,
      completedAt: true,
      createdAt: true,
      service: {
        select: {
          id: true,
          name: true,
          slug: true,
          category: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      },
      requester: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
      assignedCbt: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      transactions: {
        where: {
          type: {
            in: [TransactionType.REFUND, TransactionType.PENALTY],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          type: true,
          status: true,
          amount: true,
          reference: true,
          createdAt: true,
        },
      },
    },
  },
});

const cbtOrderListSelect = Prisma.validator<Prisma.OrderSelect>()({
  id: true,
  orderNumber: true,
  status: true,
  deliveryMode: true,
  fulfillmentType: true,
  totalAmount: true,
  platformFee: true,
  cbtCommission: true,
  requesterDocUrls: true,
  createdAt: true,
  updatedAt: true,
  assignedAt: true,
  completedAt: true,
  service: {
    select: {
      id: true,
      name: true,
      slug: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  },
  requester: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
    },
  },
  assignedCbt: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      cbtProfile: {
        select: {
          centerName: true,
          approvalStatus: true,
        },
      },
    },
  },
});

type OrderListRecord = Prisma.OrderGetPayload<{
  select: typeof orderListSelect;
}>;
type OrderDetailRecord = Prisma.OrderGetPayload<{
  select: typeof orderDetailSelect;
}>;
type CbtOrderListRecord = Prisma.OrderGetPayload<{
  select: typeof cbtOrderListSelect;
}>;
type MyDisputeRecord = Prisma.DisputeGetPayload<{
  select: typeof myDisputeListSelect;
}>;
type AdminDisputeRecord = Prisma.DisputeGetPayload<{
  select: typeof adminDisputeListSelect;
}>;
type DisputeFinancialTransactionRecord = {
  type: TransactionType;
  status: TransactionStatus;
  amount: bigint;
  reference: string;
  createdAt?: Date;
};

type ReleaseState =
  | 'NOT_READY'
  | 'AWAITING_WINDOW'
  | 'READY_FOR_RELEASE'
  | 'RELEASED';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly ordersReleaseQueueService: OrdersReleaseQueueService,
  ) {}

  private readonly maxUploadSizeBytes = 5 * 1024 * 1024;
  private readonly allowedDocumentMimeTypes = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

  private readonly activeStatuses: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.ASSIGNED,
    OrderStatus.IN_PROGRESS,
  ];

  private readonly issueStatuses: OrderStatus[] = [
    OrderStatus.DISPUTED,
    OrderStatus.RESOLVED,
    OrderStatus.REFUNDED,
  ];

  async getMyOrders(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { requesterId: userId },
      orderBy: { createdAt: 'desc' },
      select: orderListSelect,
    });

    const metrics = {
      all: orders.length,
      active: orders.filter((order) =>
        this.activeStatuses.includes(order.status),
      ).length,
      completed: orders.filter(
        (order) => order.status === OrderStatus.COMPLETED,
      ).length,
      issues: orders.filter((order) =>
        this.issueStatuses.includes(order.status),
      ).length,
    };

    return {
      message: 'Orders retrieved',
      data: {
        metrics,
        items: orders.map((order) => this.serializeOrderSummary(order)),
      },
    };
  }

  async getMyOrderDetail(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        requesterId: userId,
      },
      select: orderDetailSelect,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      message: 'Order detail retrieved',
      data: this.serializeOrderDetail(order),
    };
  }

  async getMyDisputes(userId: string, query: GetMyDisputesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.DisputeWhereInput = {
      order: {
        requesterId: userId,
      },
    };

    const [
      total,
      open,
      underReview,
      resolvedForRequester,
      resolvedForCbt,
      items,
    ] = await Promise.all([
      this.prisma.dispute.count({ where }),
      this.prisma.dispute.count({
        where: { ...where, status: DisputeStatus.OPEN },
      }),
      this.prisma.dispute.count({
        where: { ...where, status: DisputeStatus.UNDER_REVIEW },
      }),
      this.prisma.dispute.count({
        where: {
          ...where,
          status: DisputeStatus.RESOLVED_FOR_REQUESTER,
        },
      }),
      this.prisma.dispute.count({
        where: {
          ...where,
          status: DisputeStatus.RESOLVED_FOR_CBT,
        },
      }),
      this.prisma.dispute.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: myDisputeListSelect,
      }),
    ]);

    return {
      message: 'Disputes retrieved',
      data: {
        metrics: {
          all: total,
          open,
          underReview,
          resolvedForRequester,
          resolvedForCbt,
        },
        items: items.map((item) => this.serializeDisputeSummary(item)),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          hasNextPage: page * limit < total,
        },
      },
    };
  }

  async createDispute(userId: string, orderId: string, dto: CreateDisputeDto) {
    const now = new Date();
    const reason = dto.reason.trim();
    const evidenceUrls = this.normalizeRequesterDocUrls(dto.evidenceUrls);

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        requesterId: userId,
      },
      select: orderDetailSelect,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.fulfillmentType !== 'MANUAL' || !order.assignedCbt) {
      throw new BadRequestException(
        'Only CBT-fulfilled completed orders can enter dispute review right now.',
      );
    }

    if (order.status !== OrderStatus.COMPLETED) {
      throw new ConflictException(
        'Only completed orders can be moved into dispute review.',
      );
    }

    if (!order.resultFileUrl) {
      throw new ConflictException(
        'A dispute can only be raised after a result has been submitted.',
      );
    }

    if (order.escrowReleasedAt) {
      throw new ConflictException(
        'This order has already been finalized, so a new dispute cannot be opened.',
      );
    }

    if (
      !order.disputeWindowExpiresAt ||
      order.disputeWindowExpiresAt.getTime() <= now.getTime()
    ) {
      throw new ConflictException(
        'The dispute window has closed for this order.',
      );
    }

    if (order.dispute) {
      throw new ConflictException(
        'A dispute has already been opened for this order.',
      );
    }

    const assignedCbt = order.assignedCbt;

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.dispute.create({
        data: {
          orderId: order.id,
          raisedById: userId,
          reason,
          evidenceUrls,
          status: DisputeStatus.OPEN,
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.DISPUTED,
        },
      });

      await tx.notification.createMany({
        data: [
          {
            userId,
            orderId: order.id,
            type: NotificationType.DISPUTE_RAISED,
            title: 'Dispute submitted',
            message: `Your dispute for ${order.orderNumber} has been opened and is awaiting review.`,
            metadata: {
              orderNumber: order.orderNumber,
            },
          },
          {
            userId: assignedCbt.id,
            orderId: order.id,
            type: NotificationType.DISPUTE_RAISED,
            title: 'A dispute was raised on your job',
            message: `${order.orderNumber} is now under dispute review.`,
            metadata: {
              orderNumber: order.orderNumber,
            },
          },
        ],
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'ORDER_DISPUTE_RAISED',
          entity: 'Order',
          entityId: order.id,
          oldValues: {
            status: order.status,
          },
          newValues: {
            orderNumber: order.orderNumber,
            status: OrderStatus.DISPUTED,
            disputeStatus: DisputeStatus.OPEN,
            evidenceUrls,
          },
        },
      });

      const refreshedOrder = await tx.order.findUnique({
        where: { id: order.id },
        select: orderDetailSelect,
      });

      if (!refreshedOrder) {
        throw new NotFoundException('Order not found');
      }

      return refreshedOrder;
    });

    await this.ordersReleaseQueueService
      .removeScheduledReleaseForOrder(order.id)
      .catch(() => undefined);

    return {
      message: 'Dispute created successfully.',
      data: this.serializeOrderDetail(updatedOrder),
    };
  }

  async getAdminOrders(query: GetAdminOrdersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const search = query.search?.trim() || undefined;
    const now = new Date();
    const releaseWhere = this.buildReleaseStateWhere(query.releaseState, now);

    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.fulfillmentType
        ? { fulfillmentType: query.fulfillmentType }
        : {}),
      ...(query.requesterRole
        ? { requester: { role: query.requesterRole } }
        : {}),
      ...releaseWhere,
      ...(search
        ? {
            OR: [
              {
                orderNumber: { contains: search, mode: 'insensitive' as const },
              },
              {
                service: {
                  name: { contains: search, mode: 'insensitive' as const },
                },
              },
              {
                requester: {
                  email: { contains: search, mode: 'insensitive' as const },
                },
              },
              {
                requester: {
                  firstName: { contains: search, mode: 'insensitive' as const },
                },
              },
              {
                requester: {
                  lastName: { contains: search, mode: 'insensitive' as const },
                },
              },
            ],
          }
        : {}),
    };

    const [total, orders, statusGroups] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: adminOrderListSelect,
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { _all: true },
        where,
      }),
    ]);

    const metrics = {
      all: total,
      active: statusGroups
        .filter((item) => this.activeStatuses.includes(item.status))
        .reduce((sum, item) => sum + item._count._all, 0),
      completed: statusGroups
        .filter((item) => item.status === OrderStatus.COMPLETED)
        .reduce((sum, item) => sum + item._count._all, 0),
      issues: statusGroups
        .filter((item) => this.issueStatuses.includes(item.status))
        .reduce((sum, item) => sum + item._count._all, 0),
      awaitingRelease: await this.prisma.order.count({
        where: {
          ...where,
          status: OrderStatus.COMPLETED,
          escrowReleasedAt: null,
          disputeWindowExpiresAt: {
            gt: now,
          },
        },
      }),
      readyForRelease: await this.prisma.order.count({
        where: {
          ...where,
          status: OrderStatus.COMPLETED,
          escrowReleasedAt: null,
          disputeWindowExpiresAt: {
            lte: now,
          },
        },
      }),
    };

    return {
      message: 'Admin orders retrieved',
      data: {
        metrics,
        items: orders.map((order) =>
          this.serializeAdminOrderSummary(order, now),
        ),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          hasNextPage: page * limit < total,
        },
        filters: {
          search: search ?? null,
          status: query.status ?? null,
          fulfillmentType: query.fulfillmentType ?? null,
          requesterRole: query.requesterRole ?? null,
          releaseState: query.releaseState ?? null,
        },
      },
    };
  }

  async getAdminDisputes(query: GetAdminDisputesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const search = query.search?.trim() || undefined;

    const where: Prisma.DisputeWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              {
                order: {
                  orderNumber: {
                    contains: search,
                    mode: 'insensitive' as const,
                  },
                },
              },
              {
                order: {
                  service: {
                    name: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                },
              },
              {
                order: {
                  requester: {
                    email: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                },
              },
              {
                reason: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [total, open, underReview, redoRequested, resolved, items] =
      await Promise.all([
        this.prisma.dispute.count({ where }),
        this.prisma.dispute.count({
          where: { ...where, status: DisputeStatus.OPEN },
        }),
        this.prisma.dispute.count({
          where: { ...where, status: DisputeStatus.UNDER_REVIEW },
        }),
        this.prisma.dispute.count({
          where: { ...where, status: DisputeStatus.REDO_REQUESTED },
        }),
        this.prisma.dispute.count({
          where: {
            ...where,
            status: {
              in: [
                DisputeStatus.RESOLVED_FOR_REQUESTER,
                DisputeStatus.RESOLVED_FOR_CBT,
              ],
            },
          },
        }),
        this.prisma.dispute.findMany({
          where,
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
          select: adminDisputeListSelect,
        }),
      ]);

    return {
      message: 'Admin disputes retrieved',
      data: {
        metrics: {
          all: total,
          open,
          underReview,
          redoRequested,
          resolved,
        },
        items: items.map((item) => this.serializeAdminDisputeSummary(item)),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          hasNextPage: page * limit < total,
        },
        filters: {
          search: search ?? null,
          status: query.status ?? null,
        },
      },
    };
  }

  async getAdminOperationsOverview() {
    const now = new Date();
    const [
      approvedCbtCenters,
      pendingPoolJobs,
      assignedJobs,
      inProgressJobs,
      completedJobs,
      availableJobs,
      disputeConfig,
      completedManualOrders,
    ] = await Promise.all([
      this.prisma.cbtProfile.count({
        where: { approvalStatus: CbtApprovalStatus.APPROVED },
      }),
      this.prisma.order.count({
        where: {
          fulfillmentType: 'MANUAL',
          status: OrderStatus.PENDING,
          assignedCbtId: null,
        },
      }),
      this.prisma.order.count({
        where: {
          fulfillmentType: 'MANUAL',
          status: OrderStatus.ASSIGNED,
        },
      }),
      this.prisma.order.count({
        where: {
          fulfillmentType: 'MANUAL',
          status: OrderStatus.IN_PROGRESS,
        },
      }),
      this.prisma.order.count({
        where: {
          fulfillmentType: 'MANUAL',
          status: OrderStatus.COMPLETED,
        },
      }),
      this.prisma.order.findMany({
        where: {
          fulfillmentType: 'MANUAL',
          status: OrderStatus.PENDING,
          assignedCbtId: null,
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: adminOrderListSelect,
      }),
      this.prisma.systemConfig.findUnique({
        where: { key: 'DISPUTE_WINDOW_HOURS' },
        select: { value: true },
      }),
      this.prisma.order.findMany({
        where: {
          fulfillmentType: 'MANUAL',
          status: OrderStatus.COMPLETED,
          escrowReleasedAt: null,
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: orderDetailSelect,
      }),
    ]);

    const releaseCandidates = completedManualOrders
      .map((order) => ({
        order,
        candidate: this.buildReleaseSchedulerCandidate(order, now),
      }))
      .sort(
        (left, right) =>
          left.candidate.scheduledFor.getTime() -
          right.candidate.scheduledFor.getTime(),
      );

    const readyReleaseCandidates = releaseCandidates.filter(
      (item) =>
        !item.candidate.blockedReasons.length &&
        item.candidate.shouldEnqueueNow,
    );
    const waitingReleaseCandidates = releaseCandidates.filter(
      (item) =>
        !item.candidate.blockedReasons.length &&
        !item.candidate.shouldEnqueueNow,
    );
    const blockedReleaseCandidates = releaseCandidates.filter(
      (item) => item.candidate.blockedReasons.length,
    );

    return {
      message: 'Admin operations overview retrieved',
      data: {
        metrics: {
          approvedCbtCenters,
          pendingPoolJobs,
          assignedJobs,
          inProgressJobs,
          completedJobs,
          awaitingRelease: waitingReleaseCandidates.length,
          readyForRelease: readyReleaseCandidates.length,
        },
        scheduler: {
          disputeWindowHours: Number(disputeConfig?.value ?? '2'),
          readyCount: readyReleaseCandidates.length,
          awaitingCount: waitingReleaseCandidates.length,
          blockedCount: blockedReleaseCandidates.length,
          nextWindowExpiryAt:
            waitingReleaseCandidates[0]?.order.disputeWindowExpiresAt ?? null,
          queueName: RELEASE_ESCROW_QUEUE_NAME,
          jobName: RELEASE_ESCROW_JOB_NAME,
        },
        previews: {
          availableJobs: availableJobs.map((order) =>
            this.serializeAdminOrderSummary(order, now),
          ),
          readyForRelease: readyReleaseCandidates
            .slice(0, 5)
            .map((item) => this.serializeAdminOverviewOrder(item.order, now)),
          awaitingWindow: waitingReleaseCandidates
            .slice(0, 5)
            .map((item) => this.serializeAdminOverviewOrder(item.order, now)),
        },
      },
    };
  }

  async getAdminReleaseSchedulerPreview() {
    const now = new Date();
    const orders = await this.prisma.order.findMany({
      where: {
        fulfillmentType: 'MANUAL',
        status: OrderStatus.COMPLETED,
        escrowReleasedAt: null,
      },
      orderBy: [{ disputeWindowExpiresAt: 'asc' }, { updatedAt: 'desc' }],
      take: 30,
      select: orderDetailSelect,
    });

    const candidateBuckets = orders.reduce<{
      ready: AdminReleaseSchedulerPreviewData['readyCandidates'];
      waiting: AdminReleaseSchedulerPreviewData['waitingCandidates'];
      blocked: AdminReleaseSchedulerPreviewData['blockedCandidates'];
    }>(
      (accumulator, order) => {
        const candidate = this.buildReleaseSchedulerCandidate(order, now);

        if (candidate.blockedReasons.length) {
          accumulator.blocked.push(candidate);
        } else if (candidate.shouldEnqueueNow) {
          accumulator.ready.push(candidate);
        } else {
          accumulator.waiting.push(candidate);
        }

        return accumulator;
      },
      {
        ready: [],
        waiting: [],
        blocked: [],
      },
    );

    return {
      message: 'Admin release scheduler preview retrieved',
      data: {
        queueName: RELEASE_ESCROW_QUEUE_NAME,
        jobName: RELEASE_ESCROW_JOB_NAME,
        summary: {
          readyCount: candidateBuckets.ready.length,
          waitingCount: candidateBuckets.waiting.length,
          blockedCount: candidateBuckets.blocked.length,
        },
        readyCandidates: candidateBuckets.ready,
        waitingCandidates: candidateBuckets.waiting,
        blockedCandidates: candidateBuckets.blocked,
      } satisfies AdminReleaseSchedulerPreviewData,
    };
  }

  async getAdminOrderDetail(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: orderDetailSelect,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      message: 'Admin order detail retrieved',
      data: this.serializeOrderDetail(order),
    };
  }

  async getAdminOrderReleasePreview(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: orderDetailSelect,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      message: 'Admin order release preview retrieved',
      data: this.buildAdminOrderReleasePreview(order),
    };
  }

  async updateAdminOrderNotes(orderId: string, dto: UpdateAdminOrderNotesDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        adminNotes: dto.adminNotes.trim() || null,
      },
      select: orderDetailSelect,
    });

    return {
      message: 'Admin notes updated',
      data: this.serializeOrderDetail(updatedOrder),
    };
  }

  async reviewDispute(
    adminUserId: string,
    orderId: string,
    dto: ReviewDisputeDto,
  ) {
    const now = new Date();
    const resolutionNote = dto.resolutionNote?.trim() || null;

    if (
      dto.action !== 'UNDER_REVIEW' &&
      (!resolutionNote || resolutionNote.length < 3)
    ) {
      throw new BadRequestException(
        'Please include a short resolution note before completing this dispute action.',
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: orderDetailSelect,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.dispute) {
      throw new NotFoundException('No dispute exists on this order.');
    }

    const dispute = order.dispute;

    const allowedStatuses: DisputeStatus[] = [
      DisputeStatus.OPEN,
      DisputeStatus.UNDER_REVIEW,
      DisputeStatus.REDO_REQUESTED,
    ];
    if (
      dto.action !== 'UNDER_REVIEW' &&
      !allowedStatuses.includes(dispute.status)
    ) {
      throw new ConflictException(
        'This dispute is no longer in a reviewable state.',
      );
    }

    if (
      dto.action === 'UNDER_REVIEW' &&
      dispute.status !== DisputeStatus.OPEN
    ) {
      throw new ConflictException(
        'Only newly opened disputes can be moved into review.',
      );
    }

    if (
      dto.action === 'REQUEST_REDO' &&
      !(
        [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW] as DisputeStatus[]
      ).includes(dispute.status)
    ) {
      throw new ConflictException(
        'Redo can only be requested while the dispute is open or under review.',
      );
    }

    if (
      (dto.action === 'RESOLVED_FOR_CBT' || dto.action === 'REQUEST_REDO') &&
      (order.fulfillmentType !== 'MANUAL' || !order.assignedCbt)
    ) {
      throw new BadRequestException(
        'Only CBT-fulfilled orders can be resolved in favor of a CBT center.',
      );
    }

    if (
      dto.action === 'RESOLVED_FOR_CBT' &&
      (!order.resultFileUrl ||
        !(
          [OrderStatus.COMPLETED, OrderStatus.DISPUTED] as OrderStatus[]
        ).includes(order.status))
    ) {
      throw new ConflictException(
        'A CBT-favor resolution requires a completed order with a submitted result file.',
      );
    }

    if (
      dto.flagCbtPenalty &&
      (dto.action !== 'RESOLVED_FOR_REQUESTER' ||
        order.fulfillmentType !== 'MANUAL' ||
        !order.assignedCbt)
    ) {
      throw new BadRequestException(
        'CBT penalty review can only be flagged when resolving a CBT-fulfilled dispute in favor of the requester.',
      );
    }

    const outcome = this.getDisputeReviewOutcome(dto.action);

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      let resolvedOrderStatus: OrderStatus = outcome.orderStatus;
      let refundReference: string | null = null;
      let penaltyReference: string | null = null;
      let refundExecution:
        | 'NOT_APPLICABLE'
        | 'EXECUTED'
        | 'MANUAL_RECONCILIATION_REQUIRED' = 'NOT_APPLICABLE';
      let penaltyExecution:
        | 'NOT_APPLICABLE'
        | 'FLAGGED_FOR_REVIEW'
        | 'NOT_REQUESTED' = 'NOT_APPLICABLE';

      if (dto.action === 'RESOLVED_FOR_REQUESTER') {
        const requesterWallet = await tx.wallet.findUnique({
          where: { userId: order.requester.id },
          select: {
            id: true,
            availableBalance: true,
            escrowBalance: true,
          },
        });

        if (!requesterWallet) {
          throw new NotFoundException('Requester wallet not found.');
        }

        if (!order.escrowReleasedAt) {
          if (requesterWallet.escrowBalance < order.totalAmount) {
            throw new ConflictException(
              'Requester escrow balance no longer matches the order amount for refund handling.',
            );
          }

          const balanceBefore = requesterWallet.availableBalance;
          const balanceAfter = balanceBefore + order.totalAmount;
          const escrowAfter = requesterWallet.escrowBalance - order.totalAmount;
          refundReference = generateTransactionRef();
          refundExecution = 'EXECUTED';
          resolvedOrderStatus = OrderStatus.REFUNDED;

          await tx.wallet.update({
            where: { id: requesterWallet.id },
            data: {
              availableBalance: balanceAfter,
              escrowBalance: escrowAfter,
            },
          });

          await tx.transaction.create({
            data: {
              walletId: requesterWallet.id,
              userId: order.requester.id,
              orderId: order.id,
              type: TransactionType.REFUND,
              status: TransactionStatus.SUCCESS,
              amount: order.totalAmount,
              balanceBefore,
              balanceAfter,
              reference: refundReference,
              description: `Dispute refund issued for ${order.orderNumber}`,
              metadata: {
                orderNumber: order.orderNumber,
                refundSource: 'dispute-resolution',
                refundedFromEscrow: true,
                escrowBalanceBefore: requesterWallet.escrowBalance.toString(),
                escrowBalanceAfter: escrowAfter.toString(),
              },
            },
          });
        } else {
          refundExecution = 'MANUAL_RECONCILIATION_REQUIRED';
          resolvedOrderStatus = OrderStatus.RESOLVED;
        }

        if (order.fulfillmentType === 'MANUAL' && order.assignedCbt) {
          if (dto.flagCbtPenalty) {
            const cbtWallet = await tx.wallet.findUnique({
              where: { userId: order.assignedCbt.id },
              select: {
                id: true,
                availableBalance: true,
              },
            });

            if (!cbtWallet) {
              throw new NotFoundException('CBT wallet not found.');
            }

            penaltyReference = generateTransactionRef();
            penaltyExecution = 'FLAGGED_FOR_REVIEW';

            await tx.transaction.create({
              data: {
                walletId: cbtWallet.id,
                userId: order.assignedCbt.id,
                orderId: order.id,
                type: TransactionType.PENALTY,
                status: TransactionStatus.PENDING,
                amount: order.cbtCommission,
                balanceBefore: cbtWallet.availableBalance,
                balanceAfter: cbtWallet.availableBalance,
                reference: penaltyReference,
                description: `Penalty review opened for ${order.orderNumber}`,
                metadata: {
                  orderNumber: order.orderNumber,
                  disputeId: dispute.id,
                  stage: 'dispute-review',
                  requestedBy: adminUserId,
                  resolutionNote,
                },
              },
            });
          } else {
            penaltyExecution = 'NOT_REQUESTED';
          }
        }
      }

      await tx.dispute.update({
        where: { orderId: order.id },
        data: {
          status: outcome.disputeStatus,
          resolutionNote,
          resolvedAt: outcome.markResolved ? now : null,
          resolvedById: outcome.markResolved ? adminUserId : null,
          redoDeadline: outcome.redoDeadline,
          redoCompletedAt:
            outcome.disputeStatus === DisputeStatus.REDO_REQUESTED
              ? null
              : dispute.redoCompletedAt,
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: resolvedOrderStatus,
          resultFileUrl: outcome.clearResult ? null : order.resultFileUrl,
          resultUploadedAt: outcome.clearResult ? null : order.resultUploadedAt,
          completedAt: outcome.clearResult ? null : order.completedAt,
          disputeWindowExpiresAt: outcome.clearResult
            ? null
            : order.disputeWindowExpiresAt,
        },
      });

      const notificationPayloads: Prisma.NotificationCreateManyInput[] = [
        {
          userId: order.requester.id,
          orderId: order.id,
          type: NotificationType.DISPUTE_RESOLVED,
          title:
            outcome.disputeStatus === DisputeStatus.UNDER_REVIEW
              ? 'Dispute moved into review'
              : outcome.disputeStatus === DisputeStatus.REDO_REQUESTED
                ? 'Redo requested'
                : 'Dispute decision recorded',
          message:
            dto.action === 'RESOLVED_FOR_REQUESTER' &&
            refundExecution === 'EXECUTED'
              ? 'The dispute was resolved in your favor and the order amount has been returned to your wallet.'
              : dto.action === 'RESOLVED_FOR_REQUESTER' &&
                  refundExecution === 'MANUAL_RECONCILIATION_REQUIRED'
                ? 'The dispute was resolved in your favor. The order is now held for manual refund follow-up.'
                : outcome.requesterMessage,
          metadata: {
            orderNumber: order.orderNumber,
            disputeStatus: outcome.disputeStatus,
            refundExecution,
            refundReference,
          },
        },
      ];

      if (order.assignedCbt) {
        notificationPayloads.push({
          userId: order.assignedCbt.id,
          orderId: order.id,
          type: NotificationType.DISPUTE_RESOLVED,
          title:
            outcome.disputeStatus === DisputeStatus.UNDER_REVIEW
              ? 'Dispute moved into review'
              : outcome.disputeStatus === DisputeStatus.REDO_REQUESTED
                ? 'Redo requested'
                : 'Dispute decision recorded',
          message:
            dto.action === 'RESOLVED_FOR_REQUESTER' &&
            penaltyExecution === 'FLAGGED_FOR_REVIEW'
              ? 'The dispute was resolved in favor of the requester and a penalty review entry has been opened against this order.'
              : outcome.cbtMessage,
          metadata: {
            orderNumber: order.orderNumber,
            disputeStatus: outcome.disputeStatus,
            penaltyExecution,
            penaltyReference,
          },
        });
      }

      await tx.notification.createMany({
        data: notificationPayloads,
      });

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'ORDER_DISPUTE_REVIEWED',
          entity: 'Order',
          entityId: order.id,
          oldValues: {
            orderStatus: order.status,
            disputeStatus: dispute.status,
            resolutionNote: dispute.resolutionNote,
            redoDeadline: dispute.redoDeadline?.toISOString() ?? null,
          },
          newValues: {
            orderNumber: order.orderNumber,
            orderStatus: resolvedOrderStatus,
            disputeStatus: outcome.disputeStatus,
            resolutionNote,
            redoDeadline: outcome.redoDeadline?.toISOString() ?? null,
            refundExecution,
            refundReference,
            penaltyExecution,
            penaltyReference,
          },
        },
      });

      const refreshedOrder = await tx.order.findUnique({
        where: { id: order.id },
        select: orderDetailSelect,
      });

      if (!refreshedOrder) {
        throw new NotFoundException('Order not found');
      }

      return refreshedOrder;
    });

    if (dto.action === 'REQUEST_REDO') {
      await this.ordersReleaseQueueService
        .removeScheduledReleaseForOrder(order.id)
        .catch(() => undefined);
    }

    if (dto.action === 'RESOLVED_FOR_REQUESTER') {
      await this.ordersReleaseQueueService
        .removeScheduledReleaseForOrder(order.id)
        .catch(() => undefined);
    }

    if (dto.action === 'RESOLVED_FOR_CBT') {
      try {
        await this.ordersReleaseQueueService.scheduleReleaseForOrder(order.id);
      } catch {
        // Startup recovery will re-enqueue completed jobs if needed.
      }
    }

    return {
      message: outcome.successMessage,
      data: this.serializeOrderDetail(updatedOrder),
    };
  }

  async getCbtDashboard(userId: string) {
    const cbtUser = await this.ensureApprovedCbtUser(userId);

    const [
      availableCount,
      activeCount,
      completedCount,
      availableJobs,
      myJobs,
      wallet,
    ] = await Promise.all([
      this.prisma.order.count({
        where: {
          fulfillmentType: 'MANUAL',
          assignedCbtId: null,
          status: OrderStatus.PENDING,
        },
      }),
      this.prisma.order.count({
        where: {
          assignedCbtId: userId,
          status: { in: [OrderStatus.ASSIGNED, OrderStatus.IN_PROGRESS] },
        },
      }),
      this.prisma.order.count({
        where: {
          assignedCbtId: userId,
          status: OrderStatus.COMPLETED,
        },
      }),
      this.prisma.order.findMany({
        where: {
          fulfillmentType: 'MANUAL',
          assignedCbtId: null,
          status: OrderStatus.PENDING,
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: cbtOrderListSelect,
      }),
      this.prisma.order.findMany({
        where: { assignedCbtId: userId },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: cbtOrderListSelect,
      }),
      this.prisma.wallet.findUnique({
        where: { userId },
        select: {
          availableBalance: true,
          totalEarned: true,
          totalWithdrawn: true,
        },
      }),
    ]);

    return {
      message: 'CBT dashboard retrieved',
      data: {
        centerName: cbtUser.cbtProfile!.centerName,
        approvalStatus: cbtUser.cbtProfile!.approvalStatus,
        metrics: {
          availableJobs: availableCount,
          activeJobs: activeCount,
          completedJobs: completedCount,
          totalEarned: wallet?.totalEarned.toString() ?? '0',
          availableBalance: wallet?.availableBalance.toString() ?? '0',
          totalWithdrawn: wallet?.totalWithdrawn.toString() ?? '0',
        },
        availableJobs: availableJobs.map((order) =>
          this.serializeCbtOrderSummary(order),
        ),
        myJobs: myJobs.map((order) => this.serializeCbtOrderSummary(order)),
      },
    };
  }

  async getCbtJobPool(userId: string, query: GetCbtJobPoolQueryDto) {
    await this.ensureApprovedCbtUser(userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const search = query.search?.trim() || undefined;

    const where: Prisma.OrderWhereInput = {
      fulfillmentType: 'MANUAL',
      assignedCbtId: null,
      status: OrderStatus.PENDING,
      ...(query.categorySlug
        ? { service: { category: { slug: query.categorySlug } } }
        : {}),
      ...(search
        ? {
            OR: [
              { orderNumber: { contains: search, mode: 'insensitive' } },
              { service: { name: { contains: search, mode: 'insensitive' } } },
              {
                requester: { email: { contains: search, mode: 'insensitive' } },
              },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: cbtOrderListSelect,
      }),
    ]);

    return {
      message: 'CBT job pool retrieved',
      data: {
        items: items.map((order) => this.serializeCbtOrderSummary(order)),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          hasNextPage: page * limit < total,
        },
        filters: {
          search: search ?? null,
          categorySlug: query.categorySlug ?? null,
        },
      },
    };
  }

  async getCbtMyJobs(userId: string, query: GetCbtMyJobsQueryDto) {
    await this.ensureApprovedCbtUser(userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const search = query.search?.trim() || undefined;

    const where: Prisma.OrderWhereInput = {
      assignedCbtId: userId,
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { orderNumber: { contains: search, mode: 'insensitive' } },
              { service: { name: { contains: search, mode: 'insensitive' } } },
              {
                requester: { email: { contains: search, mode: 'insensitive' } },
              },
            ],
          }
        : {}),
    };

    const [total, items, grouped] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: cbtOrderListSelect,
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: { assignedCbtId: userId },
      }),
    ]);

    return {
      message: 'CBT jobs retrieved',
      data: {
        metrics: {
          assigned: grouped
            .filter((item) => item.status === OrderStatus.ASSIGNED)
            .reduce((sum, item) => sum + item._count._all, 0),
          inProgress: grouped
            .filter((item) => item.status === OrderStatus.IN_PROGRESS)
            .reduce((sum, item) => sum + item._count._all, 0),
          completed: grouped
            .filter((item) => item.status === OrderStatus.COMPLETED)
            .reduce((sum, item) => sum + item._count._all, 0),
        },
        items: items.map((order) => this.serializeCbtOrderSummary(order)),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          hasNextPage: page * limit < total,
        },
        filters: {
          search: search ?? null,
          status: query.status ?? null,
        },
      },
    };
  }

  async getCbtOrderDetail(userId: string, orderId: string) {
    await this.ensureApprovedCbtUser(userId);

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        fulfillmentType: 'MANUAL',
        OR: [
          { assignedCbtId: null, status: OrderStatus.PENDING },
          { assignedCbtId: userId },
        ],
      },
      select: orderDetailSelect,
    });

    if (!order) {
      throw new NotFoundException('Job not found');
    }

    return {
      message: 'CBT job detail retrieved',
      data: this.serializeOrderDetail(order),
    };
  }

  async claimCbtJob(userId: string, orderId: string) {
    const cbtUser = await this.ensureApprovedCbtUser(userId);
    const claimedAt = new Date();

    const order = await this.prisma.$transaction(async (tx) => {
      const claimResult = await tx.order.updateMany({
        where: {
          id: orderId,
          fulfillmentType: 'MANUAL',
          assignedCbtId: null,
          status: OrderStatus.PENDING,
        },
        data: {
          assignedCbtId: userId,
          assignedAt: claimedAt,
          status: OrderStatus.ASSIGNED,
        },
      });

      if (claimResult.count === 0) {
        const existingOrder = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            fulfillmentType: true,
            status: true,
            assignedCbtId: true,
          },
        });

        if (!existingOrder) {
          throw new NotFoundException('Job not found');
        }

        if (existingOrder.fulfillmentType !== 'MANUAL') {
          throw new BadRequestException(
            'Only manual jobs can be claimed by CBT centers.',
          );
        }

        if (
          existingOrder.assignedCbtId &&
          existingOrder.assignedCbtId !== userId
        ) {
          throw new ConflictException(
            'This job has already been claimed by another CBT center.',
          );
        }

        throw new ConflictException(
          'This job is no longer available to claim.',
        );
      }

      const claimedOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: orderDetailSelect,
      });

      if (!claimedOrder) {
        throw new NotFoundException('Job not found');
      }

      await tx.notification.create({
        data: {
          userId: claimedOrder.requester.id,
          orderId: claimedOrder.id,
          type: NotificationType.ORDER_ASSIGNED,
          title: 'Your order has been assigned',
          message: `${claimedOrder.service.name} is now assigned to ${cbtUser.cbtProfile!.centerName}.`,
          metadata: {
            orderNumber: claimedOrder.orderNumber,
            assignedCbtId: userId,
            centerName: cbtUser.cbtProfile!.centerName,
          },
        },
      });

      await tx.notification.create({
        data: {
          userId,
          orderId: claimedOrder.id,
          type: NotificationType.ORDER_ASSIGNED,
          title: 'Job claimed successfully',
          message: `You have claimed ${claimedOrder.orderNumber} for ${claimedOrder.service.name}.`,
          metadata: {
            orderNumber: claimedOrder.orderNumber,
            requesterEmail: claimedOrder.requester.email,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'ORDER_CLAIMED',
          entity: 'Order',
          entityId: claimedOrder.id,
          newValues: {
            orderNumber: claimedOrder.orderNumber,
            status: OrderStatus.ASSIGNED,
            assignedCbtId: userId,
            assignedAt: claimedAt.toISOString(),
          },
        },
      });

      return claimedOrder;
    });

    return {
      message: 'Job claimed successfully.',
      data: this.serializeOrderDetail(order),
    };
  }

  async startCbtJob(userId: string, orderId: string) {
    await this.ensureApprovedCbtUser(userId);

    const order = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.order.updateMany({
        where: {
          id: orderId,
          assignedCbtId: userId,
          status: OrderStatus.ASSIGNED,
        },
        data: {
          status: OrderStatus.IN_PROGRESS,
        },
      });

      if (updateResult.count === 0) {
        const existingOrder = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            assignedCbtId: true,
            status: true,
          },
        });

        if (!existingOrder) {
          throw new NotFoundException('Job not found');
        }

        if (existingOrder.assignedCbtId !== userId) {
          throw new ForbiddenException(
            'You can only start jobs assigned to your CBT center.',
          );
        }

        if (existingOrder.status === OrderStatus.IN_PROGRESS) {
          throw new ConflictException('This job is already in progress.');
        }

        throw new ConflictException(
          'Only assigned jobs can be moved into progress.',
        );
      }

      const startedOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: orderDetailSelect,
      });

      if (!startedOrder) {
        throw new NotFoundException('Job not found');
      }

      await tx.auditLog.create({
        data: {
          userId,
          action: 'ORDER_PROGRESS_STARTED',
          entity: 'Order',
          entityId: startedOrder.id,
          oldValues: {
            status: OrderStatus.ASSIGNED,
          },
          newValues: {
            orderNumber: startedOrder.orderNumber,
            status: OrderStatus.IN_PROGRESS,
          },
        },
      });

      return startedOrder;
    });

    return {
      message: 'Job moved into progress.',
      data: this.serializeOrderDetail(order),
    };
  }

  async completeCbtJob(
    userId: string,
    orderId: string,
    file: UploadedDocumentFile | undefined,
    dto: CompleteCbtJobDto,
  ) {
    await this.ensureApprovedCbtUser(userId);

    if (!file) {
      throw new BadRequestException(
        'Please attach the completed result file before submitting this job.',
      );
    }

    this.validateUpload(file);

    const uploadedAt = new Date();
    const disputeWindowExpiresAt = new Date(
      uploadedAt.getTime() + 2 * 60 * 60 * 1000,
    );

    const currentOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        assignedCbtId: true,
        status: true,
        dispute: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!currentOrder) {
      throw new NotFoundException('Job not found');
    }

    if (currentOrder.assignedCbtId !== userId) {
      throw new ForbiddenException(
        'You can only upload results for jobs assigned to your CBT center.',
      );
    }

    if (
      currentOrder.status !== OrderStatus.ASSIGNED &&
      currentOrder.status !== OrderStatus.IN_PROGRESS
    ) {
      if (currentOrder.status === OrderStatus.COMPLETED) {
        throw new ConflictException(
          'This job has already been completed and submitted.',
        );
      }

      throw new ConflictException(
        'Only assigned or in-progress jobs can be completed.',
      );
    }

    const upload = await this.storageService.uploadFile({
      filename: this.normalizeFilename(file.originalname),
      mimeType: file.mimetype,
      data: file.buffer,
      folder: `orders/results/${userId}`,
    });

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        const updateResult = await tx.order.updateMany({
          where: {
            id: orderId,
            assignedCbtId: userId,
            status: {
              in: [OrderStatus.ASSIGNED, OrderStatus.IN_PROGRESS],
            },
          },
          data: {
            status: OrderStatus.COMPLETED,
            resultFileUrl: upload.url,
            resultUploadedAt: uploadedAt,
            completedAt: uploadedAt,
            disputeWindowExpiresAt,
            cbtNotes: dto.cbtNotes?.trim() || null,
          },
        });

        if (updateResult.count === 0) {
          const existingOrder = await tx.order.findUnique({
            where: { id: orderId },
            select: {
              id: true,
              assignedCbtId: true,
              status: true,
            },
          });

          if (!existingOrder) {
            throw new NotFoundException('Job not found');
          }

          if (existingOrder.assignedCbtId !== userId) {
            throw new ForbiddenException(
              'You can only upload results for jobs assigned to your CBT center.',
            );
          }

          if (existingOrder.status === OrderStatus.COMPLETED) {
            throw new ConflictException(
              'This job has already been completed and submitted.',
            );
          }

          throw new ConflictException(
            'Only assigned or in-progress jobs can be completed.',
          );
        }

        if (currentOrder.dispute?.status === DisputeStatus.REDO_REQUESTED) {
          await tx.dispute.update({
            where: { orderId },
            data: {
              redoCompletedAt: uploadedAt,
            },
          });
        }

        const completedOrder = await tx.order.findUnique({
          where: { id: orderId },
          select: orderDetailSelect,
        });

        if (!completedOrder) {
          throw new NotFoundException('Job not found');
        }

        await tx.notification.create({
          data: {
            userId: completedOrder.requester.id,
            orderId: completedOrder.id,
            type: NotificationType.ORDER_COMPLETED,
            title: 'Your result is ready',
            message: `${completedOrder.service.name} has been completed. Review the result before ${disputeWindowExpiresAt.toLocaleString()}.`,
            metadata: {
              orderNumber: completedOrder.orderNumber,
              disputeWindowExpiresAt: disputeWindowExpiresAt.toISOString(),
            },
          },
        });

        await tx.notification.create({
          data: {
            userId,
            orderId: completedOrder.id,
            type: NotificationType.ORDER_COMPLETED,
            title: 'Result submitted successfully',
            message: `${completedOrder.orderNumber} is now completed and awaiting the dispute window.`,
            metadata: {
              orderNumber: completedOrder.orderNumber,
              disputeWindowExpiresAt: disputeWindowExpiresAt.toISOString(),
            },
          },
        });

        await tx.auditLog.create({
          data: {
            userId,
            action: 'ORDER_RESULT_UPLOADED',
            entity: 'Order',
            entityId: completedOrder.id,
            oldValues: {
              status: currentOrder.status,
            },
            newValues: {
              orderNumber: completedOrder.orderNumber,
              status: OrderStatus.COMPLETED,
              resultFileUrl: upload.url,
              disputeWindowExpiresAt: disputeWindowExpiresAt.toISOString(),
            },
          },
        });

        return completedOrder;
      });

      try {
        await this.ordersReleaseQueueService.scheduleReleaseForOrder(order.id);
      } catch {
        // Queue recovery runs on startup, so a transient enqueue failure
        // should not undo the completed result submission.
      }

      return {
        message: 'Result uploaded and job completed successfully.',
        data: this.serializeOrderDetail(order),
      };
    } catch (error) {
      await this.storageService
        .deleteFile(upload.publicId)
        .catch(() => undefined);
      throw error;
    }
  }

  async createOrder(userId: string, dto: CreateOrderDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        wallet: {
          select: {
            id: true,
            availableBalance: true,
            escrowBalance: true,
          },
        },
      },
    });

    if (!user?.wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
      select: {
        id: true,
        name: true,
        slug: true,
        totalPrice: true,
        platformFee: true,
        cbtCommission: true,
        deliveryMode: true,
        fulfillmentType: true,
        isActive: true,
        requiredFields: true,
        requiredDocuments: true,
        category: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!service || !service.isActive) {
      throw new NotFoundException('Service not found');
    }

    if (user.wallet.availableBalance < service.totalPrice) {
      throw new BadRequestException(
        'Your wallet balance is not enough for this request.',
      );
    }

    const requiredFields = Array.isArray(service.requiredFields)
      ? (service.requiredFields as RequiredFieldDefinition[])
      : [];
    const requiredDocuments = Array.isArray(service.requiredDocuments)
      ? (service.requiredDocuments as RequiredDocumentDefinition[])
      : [];
    const normalizedSubmittedData = this.normalizeSubmittedData(
      dto.submittedData,
    );
    const normalizedRequesterDocUrls = this.normalizeRequesterDocUrls(
      dto.requesterDocUrls,
    );

    this.validateRequiredFields(requiredFields, normalizedSubmittedData);
    this.validateRequiredDocuments(
      requiredDocuments,
      normalizedRequesterDocUrls,
    );

    const balanceBefore = user.wallet.availableBalance;
    const balanceAfter = balanceBefore - service.totalPrice;
    const escrowAfter = user.wallet.escrowBalance + service.totalPrice;
    const orderNumber = generateOrderNumber();
    const transactionReference = generateTransactionRef();

    const order = await this.prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          requesterId: user.id,
          serviceId: service.id,
          status: OrderStatus.PENDING,
          deliveryMode: service.deliveryMode,
          fulfillmentType: service.fulfillmentType,
          submittedData: normalizedSubmittedData,
          requesterDocUrls: normalizedRequesterDocUrls,
          totalAmount: service.totalPrice,
          platformFee: service.platformFee,
          cbtCommission: service.cbtCommission,
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          platformFee: true,
          cbtCommission: true,
          createdAt: true,
          service: {
            select: {
              name: true,
              slug: true,
              category: {
                select: {
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      });

      await tx.wallet.update({
        where: { id: user.wallet!.id },
        data: {
          availableBalance: balanceAfter,
          escrowBalance: escrowAfter,
        },
      });

      await tx.transaction.create({
        data: {
          walletId: user.wallet!.id,
          userId: user.id,
          orderId: createdOrder.id,
          type: TransactionType.ESCROW_LOCK,
          status: TransactionStatus.SUCCESS,
          amount: service.totalPrice,
          balanceBefore,
          balanceAfter,
          reference: transactionReference,
          description: `Escrow locked for ${service.name}`,
          metadata: {
            orderNumber,
            serviceSlug: service.slug,
            serviceCategorySlug: service.category.slug,
          },
        },
      });

      await tx.notification.create({
        data: {
          userId: user.id,
          type: NotificationType.ORDER_PLACED,
          title: 'Order placed successfully',
          message: `${service.name} has been submitted and moved into escrow.`,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'ORDER_CREATED',
          entity: 'Order',
          entityId: createdOrder.id,
          newValues: {
            orderNumber: createdOrder.orderNumber,
            serviceId: service.id,
            totalAmount: service.totalPrice.toString(),
            escrowReference: transactionReference,
          },
        },
      });

      return createdOrder;
    });

    return {
      message: 'Order created successfully and payment moved into escrow.',
      data: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount.toString(),
        platformFee: order.platformFee.toString(),
        cbtCommission: order.cbtCommission.toString(),
        createdAt: order.createdAt,
        service: {
          name: order.service.name,
          slug: order.service.slug,
          category: order.service.category,
        },
        wallet: {
          availableBalance: balanceAfter.toString(),
          escrowBalance: escrowAfter.toString(),
        },
      },
    };
  }

  async uploadRequesterDocuments(
    userId: string,
    files: UploadedDocumentFile[] | undefined,
  ) {
    if (!files?.length) {
      throw new BadRequestException(
        'Please attach at least one document before uploading.',
      );
    }

    files.forEach((file) => this.validateUpload(file));

    const uploads = await Promise.all(
      files.map((file) =>
        this.storageService.uploadFile({
          filename: this.normalizeFilename(file.originalname),
          mimeType: file.mimetype,
          data: file.buffer,
          folder: `orders/requesters/${userId}`,
        }),
      ),
    );

    return {
      message: 'Documents uploaded successfully.',
      data: {
        items: uploads.map((upload, index) => ({
          url: upload.url,
          publicId: upload.publicId,
          filename: files[index]?.originalname ?? null,
        })),
      },
    };
  }

  private normalizeSubmittedData(submittedData: Record<string, string>) {
    return Object.entries(submittedData).reduce<Record<string, string>>(
      (accumulator, [key, value]) => {
        accumulator[key] = typeof value === 'string' ? value.trim() : '';
        return accumulator;
      },
      {},
    );
  }

  private validateRequiredFields(
    fields: RequiredFieldDefinition[],
    submittedData: Record<string, string>,
  ) {
    const missingLabels = fields
      .filter((field) => field.required)
      .filter((field) => !submittedData[field.name])
      .map((field) => field.label ?? field.name);

    if (missingLabels.length > 0) {
      throw new BadRequestException(
        `Please complete these required fields: ${missingLabels.join(', ')}`,
      );
    }
  }

  private normalizeRequesterDocUrls(requesterDocUrls?: string[]) {
    return (requesterDocUrls ?? [])
      .map((value) => value.trim())
      .filter(
        (value, index, array) =>
          value.length > 0 && array.indexOf(value) === index,
      );
  }

  private validateRequiredDocuments(
    requiredDocuments: RequiredDocumentDefinition[],
    requesterDocUrls: string[],
  ) {
    const requiredCount = requiredDocuments.filter(
      (document) => document.required !== false,
    ).length;

    if (requiredCount > requesterDocUrls.length) {
      const missingLabels = requiredDocuments
        .filter((document) => document.required !== false)
        .slice(requesterDocUrls.length)
        .map((document) => document.label ?? document.name);

      throw new BadRequestException(
        `Please upload these required documents: ${missingLabels.join(', ')}`,
      );
    }
  }

  private validateUpload(file: UploadedDocumentFile) {
    if (!this.allowedDocumentMimeTypes.has(file.mimetype)) {
      throw new BadRequestException(
        'Only PDF, JPG, PNG, and WEBP files can be uploaded for service requests.',
      );
    }

    if (file.size > this.maxUploadSizeBytes) {
      throw new BadRequestException(
        'Each uploaded document must be 5MB or smaller.',
      );
    }

    if (!file.buffer?.length) {
      throw new BadRequestException(
        'One of the uploaded files could not be processed. Please try again.',
      );
    }
  }

  private normalizeFilename(filename: string) {
    return filename
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .toLowerCase();
  }

  private buildOrderMetrics(status: OrderStatus) {
    return {
      isActive: this.activeStatuses.includes(status),
      hasIssue: this.issueStatuses.includes(status),
      isCompleted: status === OrderStatus.COMPLETED,
    };
  }

  private buildReleaseStateWhere(
    releaseState: AdminOrderReleaseState | undefined,
    now: Date,
  ): Prisma.OrderWhereInput {
    switch (releaseState) {
      case 'AWAITING_WINDOW':
        return {
          status: OrderStatus.COMPLETED,
          escrowReleasedAt: null,
          disputeWindowExpiresAt: {
            gt: now,
          },
        };
      case 'READY_FOR_RELEASE':
        return {
          status: OrderStatus.COMPLETED,
          escrowReleasedAt: null,
          disputeWindowExpiresAt: {
            lte: now,
          },
        };
      case 'RELEASED':
        return {
          escrowReleasedAt: {
            not: null,
          },
        };
      default:
        return {};
    }
  }

  private isReleaseBlockingDisputeStatus(status: DisputeStatus) {
    return status !== DisputeStatus.RESOLVED_FOR_CBT;
  }

  private getReleaseState(
    order: {
      status: OrderStatus;
      escrowReleasedAt?: Date | null;
      disputeWindowExpiresAt?: Date | null;
    },
    now = new Date(),
  ): ReleaseState {
    if (order.escrowReleasedAt) {
      return 'RELEASED';
    }

    if (order.status !== OrderStatus.COMPLETED) {
      return 'NOT_READY';
    }

    if (!order.disputeWindowExpiresAt) {
      return 'AWAITING_WINDOW';
    }

    return order.disputeWindowExpiresAt > now
      ? 'AWAITING_WINDOW'
      : 'READY_FOR_RELEASE';
  }

  private getDisputeReviewOutcome(action: AdminDisputeAction) {
    switch (action) {
      case 'UNDER_REVIEW':
        return {
          disputeStatus: DisputeStatus.UNDER_REVIEW,
          orderStatus: OrderStatus.DISPUTED,
          requesterMessage:
            'Your dispute is now under review. We will update you as soon as the review is completed.',
          cbtMessage:
            'This order dispute is now under review. Please stand by for the final decision.',
          successMessage: 'Dispute moved into review.',
          markResolved: false,
          redoDeadline: null,
          clearResult: false,
        };
      case 'RESOLVED_FOR_CBT':
        return {
          disputeStatus: DisputeStatus.RESOLVED_FOR_CBT,
          orderStatus: OrderStatus.COMPLETED,
          requesterMessage:
            'The dispute review has been completed and the order remains valid for release handling.',
          cbtMessage:
            'The dispute review was resolved in your favor and the order is back in the completion flow.',
          successMessage: 'Dispute resolved in favor of the CBT center.',
          markResolved: true,
          redoDeadline: null,
          clearResult: false,
        };
      case 'REQUEST_REDO':
        return {
          disputeStatus: DisputeStatus.REDO_REQUESTED,
          orderStatus: OrderStatus.IN_PROGRESS,
          requesterMessage:
            'A redo was requested on this dispute. The CBT center must resubmit the result before the case can be closed.',
          cbtMessage:
            'Admin requested a redo on this disputed order. Upload a corrected result before the new redo deadline.',
          successMessage: 'Redo requested successfully.',
          markResolved: false,
          redoDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
          clearResult: true,
        };
      case 'RESOLVED_FOR_REQUESTER':
      default:
        return {
          disputeStatus: DisputeStatus.RESOLVED_FOR_REQUESTER,
          orderStatus: OrderStatus.RESOLVED,
          requesterMessage:
            'The dispute review has been resolved in your favor. The order is now held for follow-up handling.',
          cbtMessage:
            'The dispute review has been resolved in favor of the requester. Hold further action on this order.',
          successMessage: 'Dispute resolved in favor of the requester.',
          markResolved: true,
          redoDeadline: null,
          clearResult: false,
        };
    }
  }

  private buildAdminOrderReleasePreview(
    order: OrderDetailRecord,
  ): AdminOrderReleasePreviewData {
    const now = new Date();
    const releaseState = this.getReleaseState(order, now);
    const blockedReasons = this.getReleasePreparationBlockedReasons(
      order,
      now,
      releaseState,
    );

    const platformNet = order.totalAmount - order.cbtCommission;
    const steps: AdminOrderReleasePreviewData['steps'] = [
      {
        type: 'ESCROW_RELEASE',
        amount: order.totalAmount.toString(),
        summary:
          'Debit the requester escrow bucket and mark the order as released.',
      },
      {
        type: 'CBT_COMMISSION',
        amount: order.cbtCommission.toString(),
        summary: order.assignedCbt
          ? `Credit ${order.assignedCbt.firstName} ${order.assignedCbt.lastName} with the configured CBT commission.`
          : 'A CBT credit would be created once an assignee exists.',
      },
      {
        type: 'PLATFORM_COMMISSION',
        amount: platformNet.toString(),
        summary:
          'Credit the platform ledger with the remaining retained amount after the CBT payout.',
      },
    ];

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      releaseState,
      canPrepareRelease: blockedReasons.length === 0,
      blockedReasons,
      timing: {
        completedAt: order.completedAt,
        disputeWindowExpiresAt: order.disputeWindowExpiresAt,
        escrowReleasedAt: order.escrowReleasedAt,
      },
      actors: {
        requesterEmail: order.requester.email,
        assignedCbtEmail: order.assignedCbt?.email ?? null,
        assignedCbtName: order.assignedCbt
          ? `${order.assignedCbt.firstName} ${order.assignedCbt.lastName}`
          : null,
      },
      amounts: {
        escrowLocked: order.totalAmount.toString(),
        cbtCommission: order.cbtCommission.toString(),
        platformNet: platformNet.toString(),
      },
      job: {
        queueName: RELEASE_ESCROW_QUEUE_NAME,
        jobName: RELEASE_ESCROW_JOB_NAME,
        jobId: buildReleaseEscrowJobId(order.id),
        scheduledFor: this.getReleaseScheduledFor(order),
        delayMs: this.getReleaseDelayMs(order, now),
        shouldEnqueueNow:
          releaseState === 'READY_FOR_RELEASE' && blockedReasons.length === 0,
      },
      steps,
    };
  }

  private buildReleaseSchedulerCandidate(order: OrderDetailRecord, now: Date) {
    const platformNet = order.totalAmount - order.cbtCommission;
    const releaseState = this.getReleaseState(order, now);
    const blockedReasons = this.getReleasePreparationBlockedReasons(
      order,
      now,
      releaseState,
    );

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      releaseState,
      scheduledFor: this.getReleaseScheduledFor(order),
      delayMs: this.getReleaseDelayMs(order, now),
      shouldEnqueueNow:
        releaseState === 'READY_FOR_RELEASE' && blockedReasons.length === 0,
      blockedReasons,
      jobId: buildReleaseEscrowJobId(order.id),
      queueName: RELEASE_ESCROW_QUEUE_NAME,
      jobName: RELEASE_ESCROW_JOB_NAME,
      payload: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        requesterId: order.requester.id,
        assignedCbtId: order.assignedCbt?.id ?? null,
        escrowLocked: order.totalAmount.toString(),
        cbtCommission: order.cbtCommission.toString(),
        platformNet: platformNet.toString(),
      },
    };
  }

  private getReleasePreparationBlockedReasons(
    order: OrderDetailRecord,
    now = new Date(),
    releaseState = this.getReleaseState(order, now),
  ) {
    const blockedReasons: string[] = [];

    if (order.fulfillmentType !== 'MANUAL') {
      blockedReasons.push(
        'Only manual CBT-fulfilled orders will go through the delayed escrow release engine.',
      );
    }

    if (order.status !== OrderStatus.COMPLETED) {
      blockedReasons.push('This order is not completed yet.');
    }

    if (!order.assignedCbt) {
      blockedReasons.push('No CBT is assigned to receive the release payout.');
    }

    if (!order.disputeWindowExpiresAt) {
      blockedReasons.push(
        'This completed order has no dispute-window expiry, so it cannot be scheduled safely yet.',
      );
    }

    if (
      order.dispute &&
      this.isReleaseBlockingDisputeStatus(order.dispute.status)
    ) {
      blockedReasons.push(
        'A dispute is attached to this order, so release must wait for dispute handling.',
      );
    }

    if (releaseState === 'AWAITING_WINDOW' && order.disputeWindowExpiresAt) {
      blockedReasons.push(
        'The dispute window is still active, so the future release worker should not move funds yet.',
      );
    }

    if (releaseState === 'RELEASED') {
      blockedReasons.push('Escrow has already been released for this order.');
    }

    return blockedReasons;
  }

  private getReleaseScheduledFor(order: {
    disputeWindowExpiresAt?: Date | null;
    completedAt?: Date | null;
  }) {
    if (order.disputeWindowExpiresAt) {
      return order.disputeWindowExpiresAt;
    }

    return order.completedAt ?? new Date();
  }

  private getReleaseDelayMs(
    order: {
      disputeWindowExpiresAt?: Date | null;
      completedAt?: Date | null;
    },
    now = new Date(),
  ) {
    const scheduledFor = this.getReleaseScheduledFor(order);
    return Math.max(0, scheduledFor.getTime() - now.getTime());
  }

  private serializeOrderSummary(order: OrderListRecord) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      deliveryMode: order.deliveryMode,
      fulfillmentType: order.fulfillmentType,
      totalAmount: order.totalAmount.toString(),
      platformFee: order.platformFee.toString(),
      cbtCommission: order.cbtCommission.toString(),
      submittedData: this.toStringRecord(order.submittedData),
      requesterDocUrls: this.toStringArray(order.requesterDocUrls),
      resultFileUrl: order.resultFileUrl,
      resultUploadedAt: order.resultUploadedAt,
      escrowReleasedAt: order.escrowReleasedAt,
      disputeWindowExpiresAt: order.disputeWindowExpiresAt,
      completedAt: order.completedAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      state: this.buildOrderMetrics(order.status),
      releaseState: this.getReleaseState(order),
      service: {
        id: order.service.id,
        name: order.service.name,
        slug: order.service.slug,
        category: order.service.category,
      },
    };
  }

  private serializeOrderDetail(order: OrderDetailRecord) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      deliveryMode: order.deliveryMode,
      fulfillmentType: order.fulfillmentType,
      submittedData: this.toStringRecord(order.submittedData),
      requesterDocUrls: this.toStringArray(order.requesterDocUrls),
      resultFileUrl: order.resultFileUrl,
      resultUploadedAt: order.resultUploadedAt,
      totalAmount: order.totalAmount.toString(),
      platformFee: order.platformFee.toString(),
      cbtCommission: order.cbtCommission.toString(),
      escrowReleasedAt: order.escrowReleasedAt,
      disputeWindowExpiresAt: order.disputeWindowExpiresAt,
      assignedAt: order.assignedAt,
      completedAt: order.completedAt,
      providerReference: order.providerReference,
      providerResponse: order.providerResponse,
      cbtNotes: order.cbtNotes,
      adminNotes: order.adminNotes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      state: this.buildOrderMetrics(order.status),
      releaseState: this.getReleaseState(order),
      service: {
        id: order.service.id,
        name: order.service.name,
        slug: order.service.slug,
        deliveryMode: order.service.deliveryMode,
        fulfillmentType: order.service.fulfillmentType,
        requiredFields: this.toObjectArray(order.service.requiredFields),
        requiredDocuments: this.toObjectArray(order.service.requiredDocuments),
        category: order.service.category,
      },
      requester: {
        id: order.requester.id,
        firstName: order.requester.firstName,
        lastName: order.requester.lastName,
        email: order.requester.email,
        role: order.requester.role,
      },
      assignedCbt: order.assignedCbt
        ? {
            id: order.assignedCbt.id,
            firstName: order.assignedCbt.firstName,
            lastName: order.assignedCbt.lastName,
            email: order.assignedCbt.email,
            cbtProfile: order.assignedCbt.cbtProfile,
          }
        : null,
      transactions: order.transactions.map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        status: transaction.status,
        amount: transaction.amount.toString(),
        description: transaction.description,
        reference: transaction.reference,
        createdAt: transaction.createdAt,
      })),
      dispute: order.dispute
        ? {
            ...order.dispute,
            evidenceUrls: this.toStringArray(order.dispute.evidenceUrls),
          }
        : null,
      disputeGroundwork: order.dispute
        ? this.buildDisputeGroundwork(order)
        : null,
    };
  }

  private serializeDisputeSummary(dispute: MyDisputeRecord) {
    return {
      id: dispute.id,
      status: dispute.status,
      reason: dispute.reason,
      evidenceUrls: this.toStringArray(dispute.evidenceUrls),
      resolutionNote: dispute.resolutionNote,
      createdAt: dispute.createdAt,
      updatedAt: dispute.updatedAt,
      resolvedAt: dispute.resolvedAt,
      redoDeadline: dispute.redoDeadline,
      redoCompletedAt: dispute.redoCompletedAt,
      order: {
        id: dispute.order.id,
        orderNumber: dispute.order.orderNumber,
        status: dispute.order.status,
        deliveryMode: dispute.order.deliveryMode,
        fulfillmentType: dispute.order.fulfillmentType,
        resultFileUrl: dispute.order.resultFileUrl,
        disputeWindowExpiresAt: dispute.order.disputeWindowExpiresAt,
        completedAt: dispute.order.completedAt,
        createdAt: dispute.order.createdAt,
        service: {
          id: dispute.order.service.id,
          name: dispute.order.service.name,
          slug: dispute.order.service.slug,
          category: dispute.order.service.category,
        },
      },
    };
  }

  private serializeAdminDisputeSummary(dispute: AdminDisputeRecord) {
    return {
      id: dispute.id,
      status: dispute.status,
      reason: dispute.reason,
      evidenceUrls: this.toStringArray(dispute.evidenceUrls),
      resolutionNote: dispute.resolutionNote,
      createdAt: dispute.createdAt,
      updatedAt: dispute.updatedAt,
      resolvedAt: dispute.resolvedAt,
      redoDeadline: dispute.redoDeadline,
      redoCompletedAt: dispute.redoCompletedAt,
      order: {
        id: dispute.order.id,
        orderNumber: dispute.order.orderNumber,
        status: dispute.order.status,
        deliveryMode: dispute.order.deliveryMode,
        fulfillmentType: dispute.order.fulfillmentType,
        totalAmount: dispute.order.totalAmount.toString(),
        cbtCommission: dispute.order.cbtCommission.toString(),
        platformFee: dispute.order.platformFee.toString(),
        resultFileUrl: dispute.order.resultFileUrl,
        escrowReleasedAt: dispute.order.escrowReleasedAt,
        disputeWindowExpiresAt: dispute.order.disputeWindowExpiresAt,
        completedAt: dispute.order.completedAt,
        createdAt: dispute.order.createdAt,
        service: {
          id: dispute.order.service.id,
          name: dispute.order.service.name,
          slug: dispute.order.service.slug,
          category: dispute.order.service.category,
        },
        requester: dispute.order.requester,
        assignedCbt: dispute.order.assignedCbt,
      },
      disputeGroundwork: this.buildDisputeGroundwork({
        ...dispute.order,
        dispute: {
          status: dispute.status,
          redoDeadline: dispute.redoDeadline,
          redoCompletedAt: dispute.redoCompletedAt,
        },
      }),
    };
  }

  private buildDisputeGroundwork(order: {
    totalAmount: bigint;
    cbtCommission: bigint;
    platformFee: bigint;
    escrowReleasedAt?: Date | null;
    fulfillmentType: string;
    assignedCbt?: { id: string } | null;
    transactions?: DisputeFinancialTransactionRecord[];
    dispute?: {
      status: DisputeStatus;
      redoDeadline?: Date | null;
      redoCompletedAt?: Date | null;
    } | null;
  }) {
    const platformAmountAtRisk = order.totalAmount - order.cbtCommission;
    const refundTransaction =
      order.transactions?.find(
        (transaction) => transaction.type === TransactionType.REFUND,
      ) ?? null;
    const penaltyTransaction =
      order.transactions?.find(
        (transaction) => transaction.type === TransactionType.PENALTY,
      ) ?? null;
    const penaltyApplicable =
      order.fulfillmentType === 'MANUAL' && Boolean(order.assignedCbt);
    const escrowStillLocked =
      !order.escrowReleasedAt &&
      !(
        refundTransaction &&
        refundTransaction.status === TransactionStatus.SUCCESS
      );

    return {
      refundAmount: order.totalAmount.toString(),
      escrowStillLocked,
      refundPath:
        refundTransaction != null || escrowStillLocked
          ? 'ESCROW_REFUND_PREVIEW'
          : 'MANUAL_RECONCILIATION_PREVIEW',
      cbtPenaltyCandidate: penaltyApplicable
        ? order.cbtCommission.toString()
        : null,
      platformAmountAtRisk: platformAmountAtRisk.toString(),
      redoWindowHours: 24,
      redoDeadline: order.dispute?.redoDeadline ?? null,
      redoCompletedAt: order.dispute?.redoCompletedAt ?? null,
      refundStatus: refundTransaction
        ? refundTransaction.status === TransactionStatus.SUCCESS
          ? 'EXECUTED'
          : 'PENDING'
        : order.dispute?.status === DisputeStatus.RESOLVED_FOR_REQUESTER
          ? escrowStillLocked
            ? 'PENDING'
            : 'MANUAL_RECONCILIATION_REQUIRED'
          : 'NOT_APPLICABLE',
      refundReference: refundTransaction?.reference ?? null,
      penaltyStatus: penaltyTransaction
        ? penaltyTransaction.status === TransactionStatus.PENDING
          ? 'PENDING_REVIEW'
          : 'RECORDED'
        : penaltyApplicable
          ? order.dispute?.status === DisputeStatus.RESOLVED_FOR_REQUESTER
            ? 'NOT_REQUESTED'
            : 'NOT_APPLICABLE'
          : 'NOT_APPLICABLE',
      penaltyReference: penaltyTransaction?.reference ?? null,
      releaseBlockedByDispute:
        order.dispute != null
          ? this.isReleaseBlockingDisputeStatus(order.dispute.status)
          : false,
    };
  }

  private serializeCbtOrderSummary(order: CbtOrderListRecord) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      deliveryMode: order.deliveryMode,
      fulfillmentType: order.fulfillmentType,
      totalAmount: order.totalAmount.toString(),
      platformFee: order.platformFee.toString(),
      cbtCommission: order.cbtCommission.toString(),
      requesterDocCount: this.toStringArray(order.requesterDocUrls).length,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      assignedAt: order.assignedAt,
      completedAt: order.completedAt,
      state: this.buildOrderMetrics(order.status),
      service: order.service,
      requester: {
        id: order.requester.id,
        firstName: order.requester.firstName,
        lastName: order.requester.lastName,
        email: order.requester.email,
        role: order.requester.role,
      },
      assignedCbt: order.assignedCbt
        ? {
            id: order.assignedCbt.id,
            firstName: order.assignedCbt.firstName,
            lastName: order.assignedCbt.lastName,
            email: order.assignedCbt.email,
            cbtProfile: order.assignedCbt.cbtProfile,
          }
        : null,
    };
  }

  private serializeAdminOverviewOrder(
    order: OrderDetailRecord,
    now = new Date(),
  ) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      deliveryMode: order.deliveryMode,
      fulfillmentType: order.fulfillmentType,
      totalAmount: order.totalAmount.toString(),
      platformFee: order.platformFee.toString(),
      cbtCommission: order.cbtCommission.toString(),
      submittedData: this.toStringRecord(order.submittedData),
      requesterDocUrls: this.toStringArray(order.requesterDocUrls),
      resultFileUrl: order.resultFileUrl,
      resultUploadedAt: order.resultUploadedAt,
      escrowReleasedAt: order.escrowReleasedAt,
      disputeWindowExpiresAt: order.disputeWindowExpiresAt,
      completedAt: order.completedAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      state: this.buildOrderMetrics(order.status),
      releaseState: this.getReleaseState(order, now),
      service: {
        id: order.service.id,
        name: order.service.name,
        slug: order.service.slug,
        category: order.service.category,
      },
      requester: {
        id: order.requester.id,
        firstName: order.requester.firstName,
        lastName: order.requester.lastName,
        email: order.requester.email,
        role: order.requester.role,
      },
      assignedCbt: order.assignedCbt
        ? {
            id: order.assignedCbt.id,
            firstName: order.assignedCbt.firstName,
            lastName: order.assignedCbt.lastName,
            email: order.assignedCbt.email,
          }
        : null,
    };
  }

  private serializeAdminOrderSummary(
    order: Prisma.OrderGetPayload<{ select: typeof adminOrderListSelect }>,
    now = new Date(),
  ) {
    return {
      ...this.serializeOrderSummary(order),
      requester: {
        id: order.requester.id,
        firstName: order.requester.firstName,
        lastName: order.requester.lastName,
        email: order.requester.email,
        role: order.requester.role,
      },
      assignedCbt: order.assignedCbt
        ? {
            id: order.assignedCbt.id,
            firstName: order.assignedCbt.firstName,
            lastName: order.assignedCbt.lastName,
            email: order.assignedCbt.email,
          }
        : null,
      releaseState: this.getReleaseState(order, now),
    };
  }

  private async ensureApprovedCbtUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        cbtProfile: {
          select: {
            centerName: true,
            approvalStatus: true,
          },
        },
      },
    });

    if (!user?.cbtProfile) {
      throw new NotFoundException('CBT profile not found');
    }

    if (user.cbtProfile.approvalStatus !== CbtApprovalStatus.APPROVED) {
      throw new ForbiddenException(
        'Your CBT center must be approved before it can access live jobs.',
      );
    }

    return user;
  }

  private toStringRecord(value: Prisma.JsonValue): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return Object.entries(value).reduce<Record<string, string>>(
      (accumulator, [key, entry]) => {
        accumulator[key] =
          typeof entry === 'string'
            ? entry
            : typeof entry === 'number' || typeof entry === 'boolean'
              ? String(entry)
              : '';
        return accumulator;
      },
      {},
    );
  }

  private toStringArray(value: Prisma.JsonValue): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.flatMap((entry) => {
      if (typeof entry === 'string') {
        return [entry];
      }

      if (typeof entry === 'number' || typeof entry === 'boolean') {
        return [String(entry)];
      }

      return [];
    });
  }

  private toObjectArray(
    value: Prisma.JsonValue,
  ): Array<Record<string, unknown>> {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.reduce<Array<Record<string, unknown>>>(
      (accumulator, entry) => {
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          accumulator.push(entry as Record<string, unknown>);
        }

        return accumulator;
      },
      [],
    );
  }
}
