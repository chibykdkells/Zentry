import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GetNotificationsDto } from './dto/get-notifications.dto';
import { PushDeliveryService } from './push-delivery.service';
import { SavePushSubscriptionDto } from './dto/save-push-subscription.dto';

export interface CreateNotificationData {
  userId: string;
  tenantId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  orderId?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  // Injected lazily to avoid circular dependency — set by the gateway after init
  private gatewayRef: {
    sendToUser: (userId: string, event: string, data: unknown) => void;
    broadcastToCbtPool: (event: string, data: unknown) => void;
    getConnectionStats: () => {
      totalConnectedUsers: number;
      byRole: Record<string, number>;
      byTenant: Record<string, number>;
    };
  } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushDeliveryService: PushDeliveryService,
  ) {}

  setGateway(gateway: {
    sendToUser: (userId: string, event: string, data: unknown) => void;
    broadcastToCbtPool: (event: string, data: unknown) => void;
    getConnectionStats: () => {
      totalConnectedUsers: number;
      byRole: Record<string, number>;
      byTenant: Record<string, number>;
    };
  }) {
    this.gatewayRef = gateway;
  }

  async create(data: CreateNotificationData) {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId: data.userId,
          tenantId: data.tenantId ?? null,
          type: data.type,
          title: data.title,
          message: data.message,
          orderId: data.orderId ?? null,
          metadata: data.metadata ? (data.metadata as object) : undefined,
        },
      });

      // Push to connected socket client
      this.gatewayRef?.sendToUser(data.userId, 'notification:new', {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        isRead: false,
        orderId: notification.orderId,
        createdAt: notification.createdAt.toISOString(),
      });
      void this.pushDeliveryService.sendToUser(data.userId);

      return notification;
    } catch (error) {
      // Notification failures must never break the parent transaction
      this.logger.error('Failed to create notification', error);
    }
  }

  pushNotificationToUser(
    userId: string,
    payload: {
      type: string;
      title: string;
      message: string;
      orderId?: string | null;
    },
  ) {
    this.gatewayRef?.sendToUser(userId, 'notification:new', {
      ...payload,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
    void this.pushDeliveryService.sendToUser(userId);
  }

  emitEventToUser(
    userId: string,
    event: string,
    payload: Record<string, unknown>,
  ) {
    this.gatewayRef?.sendToUser(userId, event, payload);
  }

  broadcastNewJob(payload: {
    orderId: string;
    serviceId: string;
    serviceName: string;
    tenantId: string | null;
  }) {
    this.gatewayRef?.broadcastToCbtPool('job:new', payload);
  }

  broadcastClaimedJob(payload: {
    orderId: string;
    serviceId: string;
    serviceName: string;
    tenantId: string | null;
    assignedCbtId: string;
  }) {
    this.gatewayRef?.broadcastToCbtPool('job:claimed', payload);
  }

  broadcastWalletUpdated(userId: string) {
    this.gatewayRef?.sendToUser(userId, 'wallet:updated', { userId });
  }

  async getForUser(userId: string, dto: GetNotificationsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(dto.unreadOnly ? { isRead: false } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          isRead: true,
          readAt: true,
          orderId: true,
          metadata: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      message: 'Notifications retrieved',
      data: {
        notifications: notifications.map((n) => ({
          ...n,
          createdAt: n.createdAt.toISOString(),
          readAt: n.readAt?.toISOString() ?? null,
        })),
        unreadCount,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
    };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { message: 'Unread count retrieved', data: { count } };
  }

  async markRead(notificationId: string, userId: string) {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
    return { message: 'Notification marked as read' };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { message: 'All notifications marked as read' };
  }

  getPushConfig() {
    return {
      message: 'Push config retrieved',
      data: this.pushDeliveryService.getConfig(),
    };
  }

  async getPushSubscriptionStatus(userId: string) {
    const count = await this.prisma.pushSubscription.count({
      where: { userId },
    });

    return {
      message: 'Push subscription status retrieved',
      data: {
        isSubscribed: count > 0,
        subscriptionCount: count,
        enabled: this.pushDeliveryService.isConfigured(),
      },
    };
  }

  async savePushSubscription(
    userId: string,
    tenantId: string | null,
    dto: SavePushSubscriptionDto,
    userAgent?: string | null,
  ) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: {
        userId,
        tenantId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: userAgent ?? null,
      },
      create: {
        userId,
        tenantId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: userAgent ?? null,
      },
    });

    return {
      message: 'Push subscription saved',
      data: { saved: true },
    };
  }

  async removePushSubscription(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });

    return {
      message: 'Push subscription removed',
      data: { removed: true },
    };
  }

  getConnectionStats() {
    return (
      this.gatewayRef?.getConnectionStats() ?? {
        totalConnectedUsers: 0,
        byRole: {},
        byTenant: {},
      }
    );
  }
}
