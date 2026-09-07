import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StorageService } from '../../providers/storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';

const ORDER_UPLOAD_JANITOR_BATCH_SIZE = 50;

/** Shortest gap between cleanups that ride on a request. */
const ORDER_UPLOAD_JANITOR_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class OrdersUploadJanitorService {
  private readonly logger = new Logger(OrdersUploadJanitorService.name);

  /** Seeded at construction so a deploy does not trigger a cleanup immediately. */
  private lastCleanupAt = Date.now();
  private cleanupRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Runs the cleanup off a real request, at most once per
   * {@link ORDER_UPLOAD_JANITOR_MIN_INTERVAL_MS}.
   *
   * The cron below cannot carry this on its own: the API machine suspends when
   * idle, so a six-hourly slot usually arrives while the process is not running,
   * and @nestjs/schedule does not replay a slot it missed. Riding on the request
   * that stages an upload means the cleanup happens whenever new staged rows are
   * actually being created — which is the only time there is anything to clean.
   */
  maybeCleanupStaleUploads(): void {
    if (this.cleanupRunning) return;
    if (
      Date.now() - this.lastCleanupAt <
      ORDER_UPLOAD_JANITOR_MIN_INTERVAL_MS
    ) {
      return;
    }

    this.cleanupRunning = true;
    this.lastCleanupAt = Date.now();

    void this.cleanupStaleUploads()
      .catch((error: unknown) => {
        this.logger.error(
          `Piggybacked stale upload cleanup failed: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      })
      .finally(() => {
        this.cleanupRunning = false;
      });
  }

  // A bonus, not the mechanism — see maybeCleanupStaleUploads. It also goes
  // through the same throttle so the two paths cannot overlap or double-run.
  //
  // Six-hourly rather than hourly because each run is the only thing that wakes
  // the database when the app is otherwise idle, and a Neon compute stays up for
  // minutes after any query. Expired staged uploads are orphans — nothing reads
  // them — so clearing them a few hours later costs nothing.
  @Cron(CronExpression.EVERY_6_HOURS)
  scheduledCleanup() {
    this.maybeCleanupStaleUploads();
  }

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
