import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StorageService } from '../../providers/storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';

const ORDER_UPLOAD_JANITOR_BATCH_SIZE = 50;

@Injectable()
export class OrdersUploadJanitorService {
  private readonly logger = new Logger(OrdersUploadJanitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupStaleUploads() {
    const now = new Date();
    const staleUploads = await this.prisma.uploadedOrderFile.findMany({
      where: {
        state: 'STAGED',
        expiresAt: {
          lte: now,
        },
      },
      orderBy: {
        expiresAt: 'asc',
      },
      take: ORDER_UPLOAD_JANITOR_BATCH_SIZE,
      select: {
        id: true,
        publicId: true,
      },
    });

    if (staleUploads.length === 0) {
      return {
        scannedCount: 0,
        removedCount: 0,
      };
    }

    let removedCount = 0;

    for (const upload of staleUploads) {
      try {
        await this.storageService.deleteFile(upload.publicId);
        await this.prisma.uploadedOrderFile.update({
          where: { id: upload.id },
          data: {
            state: 'DELETED',
            deletedAt: new Date(),
          },
        });
        removedCount += 1;
      } catch (error) {
        this.logger.warn(
          `Could not delete stale upload ${upload.publicId}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    }

    if (removedCount > 0) {
      this.logger.log(
        `Removed ${removedCount} stale staged upload${removedCount === 1 ? '' : 's'}.`,
      );
    }

    return {
      scannedCount: staleUploads.length,
      removedCount,
    };
  }
}
