import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Key/value store with expiry, backed by Postgres.
 *
 * It used to be Upstash Redis. That was a pay-as-you-go instance shared with
 * FEP Assist costing $10.04/month, for a workload of five methods — get, set,
 * getJson, setJson, del — all TTL'd caches and short-lived auth state. Postgres
 * is already provisioned, already the system of record, and serves this at no
 * extra cost.
 *
 * The class keeps its name and its exact public surface so no call site moved:
 * swapping what backs a store should not be an opportunity to also change a
 * cache TTL or a token lifetime by accident. The name is now a slight misnomer
 * — kept deliberately, because renaming it would have touched every consumer
 * and made the diff impossible to review as "backing store only".
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  /** How often expired rows are swept. Reads never depend on this running. */
  private static readonly SWEEP_INTERVAL_MS = 10 * 60 * 1000;

  private readonly timer: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {
    // unref so housekeeping can never be the reason the process stays alive.
    this.timer = setInterval(() => {
      void this.sweep();
    }, RedisService.SWEEP_INTERVAL_MS);
    this.timer.unref?.();
  }

  /** Returns null for a missing key and for one whose expiry has passed. */
  async get(key: string): Promise<string | null> {
    const row = await this.prisma.kvStore.findFirst({
      where: {
        key,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { value: true },
    });

    return row?.value ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt =
      ttlSeconds && ttlSeconds > 0
        ? new Date(Date.now() + ttlSeconds * 1000)
        : null;

    await this.prisma.kvStore.upsert({
      where:  { key },
      update: { value, expiresAt },
      create: { key, value, expiresAt },
    });
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async del(key: string): Promise<void> {
    // deleteMany, not delete: deleting a key that is not there is a no-op in
    // Redis, but `delete` throws P2025 on a missing row.
    await this.prisma.kvStore.deleteMany({ where: { key } });
  }

  /** Housekeeping only — correctness comes from the filter in `get`. */
  private async sweep(): Promise<void> {
    try {
      await this.prisma.kvStore.deleteMany({
        where: { expiresAt: { not: null, lte: new Date() } },
      });
    } catch (error) {
      // Never throw from a timer: an unhandled rejection would take the
      // process down over housekeeping.
      this.logger.error(`kv sweep failed: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
  }
}
