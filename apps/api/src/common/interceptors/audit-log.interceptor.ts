import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../modules/prisma/prisma.service';
import {
  AUDIT_METADATA_KEY,
  type AuditMetadata,
} from '../decorators/audit.decorator';

type AuditRequest = Request & {
  user?: { sub?: string };
  body?: unknown;
};

type AuditJsonRecord = Record<string, Prisma.InputJsonValue | null>;

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.getAllAndOverride<AuditMetadata>(
      AUDIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!metadata || context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuditRequest>();

    return next.handle().pipe(
      tap((responseData) => {
        void this.recordAudit(metadata, request, responseData);
      }),
    );
  }

  private async recordAudit(
    metadata: AuditMetadata,
    request: AuditRequest,
    responseData: unknown,
  ): Promise<void> {
    const userId = await this.resolveUserId(
      metadata.lookup,
      request,
      responseData,
    );
    const entityId = metadata.entity === 'User' ? userId : null;
    const ipAddress = request.ip ?? request.socket.remoteAddress ?? null;
    const userAgent = request.get('user-agent') ?? null;
    const requestFields = this.pickRequestFields(
      request.body,
      metadata.captureRequestFields,
    );

    if (metadata.mergeExisting && userId) {
      const latestLog = await this.prisma.auditLog.findFirst({
        where: {
          action: metadata.action,
          entity: metadata.entity,
          userId,
          createdAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000),
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (latestLog) {
        const mergedRequestFields = requestFields
          ? this.mergeJsonRecord(latestLog.newValues, requestFields)
          : null;

        await this.prisma.auditLog.update({
          where: { id: latestLog.id },
          data: {
            entityId: latestLog.entityId ?? entityId ?? undefined,
            ipAddress: latestLog.ipAddress ?? ipAddress ?? undefined,
            userAgent: latestLog.userAgent ?? userAgent ?? undefined,
            ...(mergedRequestFields
              ? {
                  newValues: mergedRequestFields,
                }
              : {}),
          },
        });
        return;
      }
    }

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: metadata.action,
        entity: metadata.entity,
        entityId,
        ipAddress,
        userAgent,
        ...(requestFields ? { newValues: requestFields } : {}),
      },
    });
  }

  private async resolveUserId(
    strategy: AuditMetadata['lookup'],
    request: AuditRequest,
    responseData: unknown,
  ): Promise<string | null> {
    switch (strategy) {
      case 'current_user':
        return request.user?.sub ?? null;
      case 'response_user':
        return this.extractResponseUserId(responseData);
      case 'body_email': {
        const email = this.extractBodyEmail(request.body);

        if (!email) {
          return null;
        }

        const user = await this.prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });

        return user?.id ?? null;
      }
      default:
        return null;
    }
  }

  private extractResponseUserId(responseData: unknown): string | null {
    if (!responseData || typeof responseData !== 'object') {
      return null;
    }

    const candidate = responseData as {
      data?: { id?: string; user?: { id?: string } };
    };

    return candidate.data?.user?.id ?? candidate.data?.id ?? null;
  }

  private pickRequestFields(
    body: unknown,
    fields: string[] | undefined,
  ): AuditJsonRecord | null {
    if (!this.isRecord(body) || !fields?.length) {
      return null;
    }

    const entries = fields
      .filter((field) => body[field] !== undefined)
      .map((field) => {
        const value = body[field];
        return this.isAuditValue(value) ? ([field, value] as const) : null;
      })
      .filter(
        (entry): entry is readonly [string, Prisma.InputJsonValue | null] =>
          entry !== null,
      );

    return entries.length ? Object.fromEntries(entries) : null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private isAuditValue(value: unknown): value is Prisma.InputJsonValue | null {
    return (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    );
  }

  private isJsonRecord(value: unknown): value is AuditJsonRecord {
    if (!this.isRecord(value) || Array.isArray(value)) {
      return false;
    }

    return Object.values(value).every((entry) => this.isAuditValue(entry));
  }

  private mergeJsonRecord(
    existing: unknown,
    incoming: AuditJsonRecord,
  ): AuditJsonRecord {
    if (!this.isJsonRecord(existing)) {
      return incoming;
    }

    const existingRecord: AuditJsonRecord = existing;

    return {
      ...existingRecord,
      ...incoming,
    };
  }

  private extractBodyEmail(body: unknown): string | null {
    if (!this.isRecord(body)) {
      return null;
    }

    const email = body['email'];

    return typeof email === 'string' ? email.toLowerCase() : null;
  }
}
