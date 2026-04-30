import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { UserRole } from '@zendocx/types';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: UserRole;
  tenantId?: string | null;
}

@WebSocketGateway({
  namespace: '/ws',
  transports: ['websocket', 'polling'],
  cors: {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      callback(null, true);
    },
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private readonly connections = new Map<
    string,
    {
      role: UserRole;
      tenantId: string | null;
      socketIds: Set<string>;
    }
  >();

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly notificationsService: NotificationsService,
  ) {}

  afterInit() {
    // Register this gateway with the service so it can push events
    this.notificationsService.setGateway(this);
    this.logger.log('WebSocket gateway initialised on namespace /ws');
  }

  async handleConnection(socket: AuthenticatedSocket) {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      socket.handshake.headers?.authorization?.replace('Bearer ', '') ??
      '';

    if (!token) {
      this.logger.warn(`Socket ${socket.id} rejected — no token`);
      socket.disconnect(true);
      return;
    }

    try {
      const jwtSecret =
        this.configService.get<string>('JWT_ACCESS_SECRET') ??
        this.configService.get<string>('JWT_SECRET', '');
      const payload = this.jwtService.verify<{
        sub: string;
        role: UserRole;
        tenantId?: string | null;
      }>(token, {
        secret: jwtSecret,
      });

      socket.userId = payload.sub;
      socket.userRole = payload.role;
      socket.tenantId = payload.tenantId ?? null;

      // Join personal room
      await socket.join(`user:${payload.sub}`);

      // CBT centers join the shared job-pool room
      if (payload.role === UserRole.CBT_CENTER) {
        await socket.join('cbt:pool');
      }

      const existingConnection = this.connections.get(payload.sub);
      if (existingConnection) {
        existingConnection.socketIds.add(socket.id);
      } else {
        this.connections.set(payload.sub, {
          role: payload.role,
          tenantId: payload.tenantId ?? null,
          socketIds: new Set([socket.id]),
        });
      }

      this.logger.debug(
        `Socket ${socket.id} connected — user ${payload.sub} (${payload.role})`,
      );
    } catch {
      this.logger.warn(`Socket ${socket.id} rejected — invalid token`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: AuthenticatedSocket) {
    if (socket.userId) {
      const existingConnection = this.connections.get(socket.userId);
      if (existingConnection) {
        existingConnection.socketIds.delete(socket.id);
        if (existingConnection.socketIds.size === 0) {
          this.connections.delete(socket.userId);
        }
      }

      this.logger.debug(
        `Socket ${socket.id} disconnected — user ${socket.userId}`,
      );
    }
  }

  sendToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  broadcastToCbtPool(event: string, data: unknown) {
    this.server.to('cbt:pool').emit(event, data);
  }

  getConnectionStats() {
    const byRole = Array.from(this.connections.values()).reduce<
      Record<UserRole, number>
    >(
      (accumulator, item) => {
        accumulator[item.role] += 1;
        return accumulator;
      },
      {
        [UserRole.INDIVIDUAL]: 0,
        [UserRole.CBT_CENTER]: 0,
        [UserRole.CBT_STAFF]: 0,
        [UserRole.TENANT_ADMIN]: 0,
        [UserRole.SUPER_ADMIN]: 0,
      },
    );

    const byTenant = Array.from(this.connections.values()).reduce<
      Record<string, number>
    >((accumulator, item) => {
      if (!item.tenantId) {
        return accumulator;
      }

      accumulator[item.tenantId] = (accumulator[item.tenantId] ?? 0) + 1;
      return accumulator;
    }, {});

    return {
      totalConnectedUsers: this.connections.size,
      byRole,
      byTenant,
    };
  }
}
