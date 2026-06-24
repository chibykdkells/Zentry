import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const SYSTEM_CONFIG_KEYS = {
  DISPUTE_WINDOW_HOURS: 'DISPUTE_WINDOW_HOURS',
  CBT_DELIVERY_WINDOW_MINUTES: 'CBT_DELIVERY_WINDOW_MINUTES',
  MIN_WITHDRAWAL_KOBO: 'MIN_WITHDRAWAL_KOBO',
  PLATFORM_COMMISSION_RATE_BPS: 'PLATFORM_COMMISSION_RATE_BPS',
  CBT_COMMISSION_RATE_BPS: 'CBT_COMMISSION_RATE_BPS',
  MAX_WITHDRAWAL_KOBO: 'MAX_WITHDRAWAL_KOBO',
} as const;

export type SystemConfigKey = keyof typeof SYSTEM_CONFIG_KEYS;

const CONFIG_META: Record<
  SystemConfigKey,
  { description: string; validator: (v: string) => boolean }
> = {
  DISPUTE_WINDOW_HOURS: {
    description:
      'Hours a requester can raise a dispute after CBT result upload (default: 2)',
    validator: (v) =>
      Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 72,
  },
  CBT_DELIVERY_WINDOW_MINUTES: {
    description:
      'Minutes a CBT has to deliver a manual job before it returns to the pool (default: 60)',
    validator: (v) =>
      Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 1440,
  },
  MIN_WITHDRAWAL_KOBO: {
    description: 'Minimum withdrawal amount in Kobo (default: 100000 = ₦1,000)',
    validator: (v) => Number.isInteger(Number(v)) && Number(v) >= 10000,
  },
  PLATFORM_COMMISSION_RATE_BPS: {
    description:
      'Platform commission in basis points — 1000 bps = 10% (default: 1000)',
    validator: (v) =>
      Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 9000,
  },
  CBT_COMMISSION_RATE_BPS: {
    description:
      'CBT commission in basis points — 8000 bps = 80% (default: 8000)',
    validator: (v) =>
      Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 9500,
  },
  MAX_WITHDRAWAL_KOBO: {
    description:
      'Maximum single withdrawal amount in Kobo (default: 50000000 = ₦500,000)',
    validator: (v) => Number.isInteger(Number(v)) && Number(v) >= 100000,
  },
};

const DEFAULTS: Record<SystemConfigKey, string> = {
  DISPUTE_WINDOW_HOURS: '2',
  CBT_DELIVERY_WINDOW_MINUTES: '60',
  MIN_WITHDRAWAL_KOBO: '100000',
  PLATFORM_COMMISSION_RATE_BPS: '1000',
  CBT_COMMISSION_RATE_BPS: '8000',
  MAX_WITHDRAWAL_KOBO: '50000000',
};

@Injectable()
export class SystemConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    const rows = await this.prisma.systemConfig.findMany({
      orderBy: { key: 'asc' },
    });

    const rowMap = new Map(rows.map((r) => [r.key, r]));

    // Return all known keys, filling defaults for any not yet persisted
    const configs = (Object.keys(SYSTEM_CONFIG_KEYS) as SystemConfigKey[]).map(
      (key) => {
        const row = rowMap.get(key);
        return {
          key,
          value: row?.value ?? DEFAULTS[key],
          description: CONFIG_META[key].description,
          updatedAt: row?.updatedAt ?? null,
          isPersisted: Boolean(row),
        };
      },
    );

    return { message: 'System config retrieved', data: configs };
  }

  async update(key: string, value: string, adminId: string) {
    if (!Object.keys(SYSTEM_CONFIG_KEYS).includes(key)) {
      throw new NotFoundException(`Unknown config key: ${key}`);
    }

    const configKey = key as SystemConfigKey;
    const meta = CONFIG_META[configKey];

    if (!meta.validator(value.trim())) {
      throw new BadRequestException(
        `Invalid value for ${key}. ${meta.description}`,
      );
    }

    const record = await this.prisma.systemConfig.upsert({
      where: { key: configKey },
      update: { value: value.trim(), updatedById: adminId },
      create: {
        key: configKey,
        value: value.trim(),
        description: meta.description,
        updatedById: adminId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'SYSTEM_CONFIG_UPDATED',
        entity: 'SystemConfig',
        entityId: record.id,
        newValues: { key: configKey, value: value.trim() },
      },
    });

    return {
      message: `${key} updated successfully`,
      data: {
        key: record.key,
        value: record.value,
        description: meta.description,
        updatedAt: record.updatedAt,
      },
    };
  }
}
