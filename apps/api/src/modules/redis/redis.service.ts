import { Injectable, Logger } from '@nestjs/common';
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
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  /**
   * Shortest gap between sweeps of expired rows.
   *
   * The sweep rides on `set` rather than on a timer. A timer queries Postgres
   * on a fixed cadence whether or not the app is doing anything, and that is
   * enough on its own to stop a Neon compute ever scaling to zero — an idle
   * API then bills as a busy one. Piggybacking on a write costs nothing: the
   * connection is already awake, and a process that has written no rows has
   * created nothing that needs sweeping.
   *
   * Reads never depend on this running — `get` filters on expiry itself, so a
   * late sweep leaves dead rows in the table and nothing else.
   */
  private static readonly SWEEP_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

  /** Seeded at construction so a restart is not itself a reason to sweep. */
  private lastSweptAt = Date.now();
  private sweeping = false;

  constructor(private readonly prisma: PrismaService) {}

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
      where: { key },
      update: { value, expiresAt },
      create: { key, value, expiresAt },
    });

    this.maybeSweep();
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

  /** Sweeps at most once per {@link SWEEP_MIN_INTERVAL_MS}, off the hot path. */
  private maybeSweep(): void {
    if (this.sweeping) return;
    if (Date.now() - this.lastSweptAt < RedisService.SWEEP_MIN_INTERVAL_MS) {
      return;
    }

    this.sweeping = true;
    this.lastSweptAt = Date.now();
    void this.sweep().finally(() => {
      this.sweeping = false;
    });
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
}
