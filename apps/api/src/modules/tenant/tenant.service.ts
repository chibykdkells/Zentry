import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Prisma, Tenant } from '@prisma/client';
import { ProviderCredentialsService } from '../../providers/provider-credentials.service';
import { StorageService } from '../../providers/storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { TenantPublic, UserRole } from '@zentry/types';
import { TenantResolverService } from './tenant-resolver.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CreateTenantAdminDto } from './dto/create-tenant-admin.dto';
import { GetTenantUsersDto } from './dto/get-tenant-users.dto';
import { UpdateOwnTenantSettingsDto } from './dto/update-own-tenant-settings.dto';

type TenantLogoFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class TenantService {
  private readonly allowedLogoMimeTypes = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
  ]);
  private readonly maxLogoSizeBytes = 2 * 1024 * 1024;

  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: TenantResolverService,
    private readonly config: ConfigService,
    private readonly providerCredentialsService: ProviderCredentialsService,
    private readonly storageService: StorageService,
  ) {}

  private generateTemporaryPassword() {
    const alphabet =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes = randomBytes(16);

    return Array.from(bytes)
      .map((byte) => alphabet[byte % alphabet.length])
      .join('')
      .slice(0, 14);
  }

  private toTenantAdminAccessRecord(access: {
    id: string;
    email: string;
    encryptedTempPassword: string;
    createdAt: Date;
    updatedAt: Date;
    lastResetAt: Date | null;
    user: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }) {
    return {
      id: access.id,
      email: access.email,
      tempPassword: this.providerCredentialsService.decrypt(
        access.encryptedTempPassword,
      ),
      createdAt: access.createdAt,
      updatedAt: access.updatedAt,
      lastResetAt: access.lastResetAt,
      user: access.user,
    };
  }

  async createTenant(
    dto: CreateTenantDto,
    createdById: string,
  ): Promise<Tenant> {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });
    if (existing)
      throw new ConflictException(`Tenant slug "${dto.slug}" is already taken`);

    if (dto.customDomain) {
      const domainConflict = await this.prisma.tenant.findUnique({
        where: { customDomain: dto.customDomain },
      });
      if (domainConflict)
        throw new ConflictException(
          `Custom domain "${dto.customDomain}" is already in use`,
        );
    }

    return this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        logoUrl: dto.logoUrl ?? null,
        primaryColor: dto.primaryColor ?? '#0D1B3E',
        accentColor: dto.accentColor ?? '#F5A623',
        textColor: '#10203C',
        buttonColor: dto.primaryColor ?? '#0D1B3E',
        fontStyle: 'modern',
        tenantMarginRate: dto.tenantMarginRate ?? 0,
        customDomain: dto.customDomain ?? null,
        createdById,
      },
    });
  }

  async listTenants(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { slug: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [tenants, total, totalUsers, totalIndividuals, totalCbtUsers] =
      await Promise.all([
        this.prisma.tenant.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.tenant.count({ where }),
        this.prisma.user.count(),
        this.prisma.user.count({
          where: { role: UserRole.INDIVIDUAL },
        }),
        this.prisma.user.count({
          where: { role: UserRole.CBT_CENTER },
        }),
      ]);

    const tenantItems = await Promise.all(
      tenants.map(async (tenant) => {
        const [
          totalUsersForTenant,
          totalIndividualsForTenant,
          totalCbtUsersForTenant,
          totalTenantAdminsForTenant,
          totalOrdersForTenant,
          totalTransactionsForTenant,
          walletAggregate,
        ] = await Promise.all([
          this.prisma.user.count({ where: { tenantId: tenant.id } }),
          this.prisma.user.count({
            where: {
              tenantId: tenant.id,
              role: UserRole.INDIVIDUAL,
            },
          }),
          this.prisma.user.count({
            where: {
              tenantId: tenant.id,
              role: UserRole.CBT_CENTER,
            },
          }),
          this.prisma.user.count({
            where: {
              tenantId: tenant.id,
              role: UserRole.TENANT_ADMIN,
            },
          }),
          this.prisma.order.count({ where: { tenantId: tenant.id } }),
          this.prisma.transaction.count({ where: { tenantId: tenant.id } }),
          this.prisma.wallet.aggregate({
            where: {
              user: {
                tenantId: tenant.id,
              },
            },
            _sum: {
              availableBalance: true,
              escrowBalance: true,
            },
          }),
        ]);

        return {
          ...tenant,
          metrics: {
            totalUsers: totalUsersForTenant,
            individualUsers: totalIndividualsForTenant,
            cbtUsers: totalCbtUsersForTenant,
            tenantAdmins: totalTenantAdminsForTenant,
            totalOrders: totalOrdersForTenant,
            totalTransactions: totalTransactionsForTenant,
            availableBalance:
              walletAggregate._sum.availableBalance?.toString() ?? '0',
            heldFunds: walletAggregate._sum.escrowBalance?.toString() ?? '0',
          },
          signupLinks: {
            individual: `/register?tenant=${tenant.slug}`,
            cbt: `/register/cbt?tenant=${tenant.slug}`,
          },
          tenantAdminAccesses: (
            await this.prisma.tenantAdminAccess.findMany({
              where: {
                tenantId: tenant.id,
                isActive: true,
              },
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                email: true,
                encryptedTempPassword: true,
                createdAt: true,
                updatedAt: true,
                lastResetAt: true,
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            })
          ).map((access) => this.toTenantAdminAccessRecord(access)),
        };
      }),
    );

    return {
      message: 'Tenants retrieved',
      data: {
        summary: {
          totalTenants: total,
          totalUsers,
          totalIndividuals,
          totalCbtUsers,
        },
        tenants: tenantItems,
        total,
        page,
        limit,
      },
    };
  }

  async getTenantById(id: string): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async getActiveTenantBySlug(slug: string): Promise<Tenant | null> {
    const normalizedSlug = slug.trim().toLowerCase();
    if (!normalizedSlug) {
      return null;
    }

    return this.prisma.tenant.findFirst({
      where: {
        slug: normalizedSlug,
        isActive: true,
      },
    });
  }

  async updateTenant(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.getTenantById(id);

    if (
      dto.customDomain !== undefined &&
      dto.customDomain !== tenant.customDomain
    ) {
      if (dto.customDomain !== null) {
        const conflict = await this.prisma.tenant.findUnique({
          where: { customDomain: dto.customDomain },
        });
        if (conflict && conflict.id !== id)
          throw new ConflictException('Custom domain already in use');
      }
      // Reset verification when domain changes
      await this.prisma.tenant.update({
        where: { id },
        data: { customDomainVerified: false },
      });
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: dto,
    });

    // Invalidate resolver cache
    await this.resolver.invalidateCache(updated.slug);

    return updated;
  }

  async createTenantAdmin(
    tenantId: string,
    dto: CreateTenantAdminDto,
    createdById: string,
  ) {
    const tenant = await this.getTenantById(tenantId);

    const [existingEmail, existingPhone] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          email: dto.email.toLowerCase(),
          tenantId,
        },
      }),
      this.prisma.user.findFirst({
        where: {
          phone: dto.phone.trim(),
          tenantId,
        },
      }),
    ]);
    if (existingEmail)
      throw new ConflictException('Email is already registered');
    if (existingPhone)
      throw new ConflictException('Phone number is already registered');

    const tempPassword = this.generateTemporaryPassword();
    const rounds = Number(this.config.get('BCRYPT_ROUNDS', '12'));
    const passwordHash = await bcrypt.hash(tempPassword, rounds);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email.toLowerCase(),
          phone: dto.phone.trim(),
          passwordHash,
          role: UserRole.TENANT_ADMIN,
          tenantId,
          isEmailVerified: true, // pre-verified — admin-provisioned account
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          tenantId: true,
        },
      });

      await tx.wallet.create({ data: { userId: created.id } });

      await tx.tenantAdminAccess.create({
        data: {
          tenantId,
          userId: created.id,
          createdById,
          email: created.email,
          encryptedTempPassword:
            this.providerCredentialsService.encrypt(tempPassword),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: createdById,
          tenantId,
          action: 'TENANT_ADMIN_CREATED',
          entity: 'User',
          entityId: created.id,
          newValues: {
            role: UserRole.TENANT_ADMIN,
            email: created.email,
            tenantId,
          },
        },
      });

      return created;
    });

    return {
      message: `Tenant admin created for "${tenant.name}". Share the temporary password securely and remove the saved access when handoff is complete.`,
      data: {
        ...user,
        tempPassword,
      },
    };
  }

  async resetTenantAdminAccessForPlatformAdmin(
    tenantId: string,
    userId: string,
    createdById: string,
  ) {
    const tenant = await this.getTenantById(tenantId);
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
        role: UserRole.TENANT_ADMIN,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        tenantId: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Business admin not found');
    }

    const tempPassword = this.generateTemporaryPassword();
    const rounds = Number(this.config.get('BCRYPT_ROUNDS', '12'));
    const passwordHash = await bcrypt.hash(tempPassword, rounds);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      await tx.tenantAdminAccess.updateMany({
        where: {
          tenantId,
          userId: user.id,
          isActive: true,
        },
        data: {
          encryptedTempPassword:
            this.providerCredentialsService.encrypt(tempPassword),
          lastResetAt: new Date(),
          dismissedAt: null,
        },
      });

      const activeCount = await tx.tenantAdminAccess.count({
        where: {
          tenantId,
          userId: user.id,
          isActive: true,
        },
      });

      if (activeCount === 0) {
        await tx.tenantAdminAccess.create({
          data: {
            tenantId,
            userId: user.id,
            createdById,
            email: user.email,
            encryptedTempPassword:
              this.providerCredentialsService.encrypt(tempPassword),
            lastResetAt: new Date(),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: createdById,
          tenantId,
          action: 'TENANT_ADMIN_PASSWORD_RESET',
          entity: 'User',
          entityId: user.id,
          newValues: {
            role: UserRole.TENANT_ADMIN,
            email: user.email,
            tenantId,
          },
        },
      });
    });

    return {
      message: `Business admin password reset for "${tenant.name}".`,
      data: {
        ...user,
        tempPassword,
      },
    };
  }

  async dismissTenantAdminAccessForPlatformAdmin(
    tenantId: string,
    accessId: string,
    dismissedById: string,
  ) {
    const access = await this.prisma.tenantAdminAccess.findFirst({
      where: {
        id: accessId,
        tenantId,
        isActive: true,
      },
      select: {
        id: true,
        userId: true,
        email: true,
      },
    });

    if (!access) {
      throw new NotFoundException('Business admin access record not found');
    }

    await this.prisma.$transaction([
      this.prisma.tenantAdminAccess.update({
        where: { id: access.id },
        data: {
          isActive: false,
          dismissedAt: new Date(),
        },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: dismissedById,
          tenantId,
          action: 'TENANT_ADMIN_ACCESS_DISMISSED',
          entity: 'TenantAdminAccess',
          entityId: access.id,
          newValues: {
            userId: access.userId,
            email: access.email,
          },
        },
      }),
    ]);

    return {
      message: 'Business admin access record removed.',
      data: { id: access.id },
    };
  }

  async getTenantOverviewForAdmin(userId: string) {
    const membership = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, tenantId: true },
    });

    if (!membership) {
      throw new NotFoundException('User not found');
    }

    if (membership.role !== 'TENANT_ADMIN' || !membership.tenantId) {
      throw new ForbiddenException('Tenant admin access is required');
    }

    const tenantId = membership.tenantId;

    const now = new Date();
    const [
      tenant,
      totalUsers,
      individualUsers,
      cbtUsers,
      recentUsers,
      orderStats,
      heldFundsAggregate,
      availableFundsAggregate,
      awaitingReleaseCount,
      readyReleaseCount,
      blockedReleaseCount,
      releaseCandidates,
    ] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId } }),
      this.prisma.user.count({ where: { tenantId } }),
      this.prisma.user.count({
        where: { tenantId, role: UserRole.INDIVIDUAL },
      }),
      this.prisma.user.count({
        where: { tenantId, role: UserRole.CBT_CENTER },
      }),
      this.prisma.user.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.wallet.aggregate({
        where: {
          user: {
            tenantId,
            role: UserRole.INDIVIDUAL,
          },
        },
        _sum: {
          escrowBalance: true,
        },
      }),
      this.prisma.wallet.aggregate({
        where: {
          user: {
            tenantId,
          },
        },
        _sum: {
          availableBalance: true,
        },
      }),
      this.prisma.order.count({
        where: {
          tenantId,
          fulfillmentType: 'MANUAL',
          status: 'COMPLETED',
          assignedCbtId: { not: null },
          escrowReleasedAt: null,
          dispute: null,
          disputeWindowExpiresAt: {
            gt: now,
          },
        },
      }),
      this.prisma.order.count({
        where: {
          tenantId,
          fulfillmentType: 'MANUAL',
          status: 'COMPLETED',
          assignedCbtId: { not: null },
          escrowReleasedAt: null,
          dispute: null,
          disputeWindowExpiresAt: {
            lte: now,
          },
        },
      }),
      this.prisma.order.count({
        where: {
          tenantId,
          fulfillmentType: 'MANUAL',
          status: 'COMPLETED',
          assignedCbtId: { not: null },
          escrowReleasedAt: null,
          dispute: { isNot: null },
        },
      }),
      this.prisma.order.findMany({
        where: {
          tenantId,
          fulfillmentType: 'MANUAL',
          status: 'COMPLETED',
          assignedCbtId: { not: null },
          escrowReleasedAt: null,
        },
        orderBy: [{ disputeWindowExpiresAt: 'asc' }, { updatedAt: 'desc' }],
        take: 6,
        select: {
          id: true,
          orderNumber: true,
          cbtCommission: true,
          disputeWindowExpiresAt: true,
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          requester: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
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
          dispute: {
            select: {
              id: true,
              status: true,
              reason: true,
            },
          },
        },
      }),
    ]);

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const counts = orderStats.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = item._count._all;
      return acc;
    }, {});

    return {
      message: 'Tenant overview retrieved',
      data: {
        tenant: this.toPublic(tenant),
        metrics: {
          totalUsers,
          individualUsers,
          cbtUsers,
          activeOrders:
            (counts.PENDING ?? 0) +
            (counts.ASSIGNED ?? 0) +
            (counts.IN_PROGRESS ?? 0),
          completedOrders: counts.COMPLETED ?? 0,
          disputedOrders: counts.DISPUTED ?? 0,
          heldFunds: heldFundsAggregate._sum.escrowBalance?.toString() ?? '0',
          availableBalance:
            availableFundsAggregate._sum.availableBalance?.toString() ?? '0',
          awaitingReleaseCount,
          readyReleaseCount,
          blockedReleaseCount,
        },
        recentUsers: recentUsers.map((user) => ({
          ...user,
          createdAt: user.createdAt.toISOString(),
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        })),
        releaseQueue: releaseCandidates.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          cbtCommission: order.cbtCommission.toString(),
          releaseState: order.dispute
            ? 'BLOCKED'
            : order.disputeWindowExpiresAt &&
                order.disputeWindowExpiresAt <= now
              ? 'READY'
              : 'AWAITING_WINDOW',
          disputeWindowExpiresAt:
            order.disputeWindowExpiresAt?.toISOString() ?? null,
          service: order.service,
          requester: {
            id: order.requester.id,
            name: `${order.requester.firstName} ${order.requester.lastName}`.trim(),
            email: order.requester.email,
          },
          assignedCbt: order.assignedCbt
            ? {
                id: order.assignedCbt.id,
                name: `${order.assignedCbt.firstName} ${order.assignedCbt.lastName}`.trim(),
                email: order.assignedCbt.email,
              }
            : null,
          dispute: order.dispute,
        })),
      },
    };
  }

  async getTenantUsersForAdmin(userId: string, query: GetTenantUsersDto) {
    const membership = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, tenantId: true },
    });

    if (!membership) {
      throw new NotFoundException('User not found');
    }

    if (membership.role !== 'TENANT_ADMIN' || !membership.tenantId) {
      throw new ForbiddenException('Tenant admin access is required');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      tenantId: membership.tenantId,
      ...(query.role ? { role: query.role } : {}),
      ...(query.search
        ? {
            OR: [
              {
                firstName: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                lastName: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      message: 'Tenant users retrieved',
      data: {
        users: users.map((user) => ({
          ...user,
          createdAt: user.createdAt.toISOString(),
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        })),
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getTenantUsersForPlatformAdmin(
    tenantId: string,
    query: GetTenantUsersDto,
  ) {
    await this.getTenantById(tenantId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      tenantId,
      ...(query.role ? { role: query.role } : {}),
      ...(query.search
        ? {
            OR: [
              {
                firstName: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                lastName: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      message: 'Tenant users retrieved',
      data: {
        users: users.map((user) => ({
          ...user,
          createdAt: user.createdAt.toISOString(),
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        })),
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async toggleTenantUserActiveForPlatformAdmin(
    superAdminId: string,
    tenantId: string,
    targetUserId: string,
  ) {
    await this.getTenantById(tenantId);

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    if (!target) {
      throw new NotFoundException('User not found in this business.');
    }

    const next = !target.isActive;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: target.id },
        data: { isActive: next },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: superAdminId,
          tenantId,
          action: next
            ? 'PLATFORM_USER_REACTIVATED'
            : 'PLATFORM_USER_DEACTIVATED',
          entity: 'User',
          entityId: target.id,
          oldValues: { isActive: target.isActive, role: target.role },
          newValues: { isActive: next },
        },
      }),
    ]);

    return {
      message: `${target.firstName} ${target.lastName} has been ${next ? 'reactivated' : 'deactivated'}.`,
      data: { id: target.id, isActive: next },
    };
  }

  async deleteTenantUserForPlatformAdmin(
    superAdminId: string,
    tenantId: string,
    targetUserId: string,
  ) {
    await this.getTenantById(tenantId);

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });

    if (!target) {
      throw new NotFoundException('User not found in this business.');
    }

    if (target.id === superAdminId) {
      throw new ForbiddenException('Cannot delete your own account.');
    }

    const [
      placedOrders,
      assignedOrders,
      transactions,
      withdrawals,
      disputesRaised,
      disputesResolved,
    ] = await Promise.all([
      this.prisma.order.count({ where: { requesterId: target.id } }),
      this.prisma.order.count({ where: { assignedCbtId: target.id } }),
      this.prisma.transaction.count({ where: { userId: target.id } }),
      this.prisma.withdrawalRequest.count({ where: { userId: target.id } }),
      this.prisma.dispute.count({ where: { raisedById: target.id } }),
      this.prisma.dispute.count({ where: { resolvedById: target.id } }),
    ]);

    const hasHistory =
      placedOrders > 0 ||
      assignedOrders > 0 ||
      transactions > 0 ||
      withdrawals > 0 ||
      disputesRaised > 0 ||
      disputesResolved > 0;

    if (hasHistory) {
      throw new BadRequestException(
        'This account has existing transaction or order history and cannot be deleted. Deactivate it instead.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.delete({ where: { id: target.id } }),
      this.prisma.auditLog.create({
        data: {
          userId: superAdminId,
          tenantId,
          action: 'PLATFORM_USER_DELETED',
          entity: 'User',
          entityId: target.id,
          oldValues: { role: target.role, email: target.email },
        },
      }),
    ]);

    return {
      message: `${target.firstName} ${target.lastName} has been permanently removed.`,
      data: { id: target.id },
    };
  }

  async updateOwnTenantSettings(
    userId: string,
    dto: UpdateOwnTenantSettingsDto,
  ) {
    const membership = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, tenantId: true },
    });

    if (!membership) {
      throw new NotFoundException('User not found');
    }

    if (membership.role !== 'TENANT_ADMIN' || !membership.tenantId) {
      throw new ForbiddenException('Tenant admin access is required');
    }

    const tenant = await this.getTenantById(membership.tenantId);

    if (
      dto.customDomain !== undefined &&
      dto.customDomain !== tenant.customDomain &&
      dto.customDomain !== null
    ) {
      const conflict = await this.prisma.tenant.findUnique({
        where: { customDomain: dto.customDomain },
      });

      if (conflict && conflict.id !== tenant.id) {
        throw new ConflictException('Custom domain already in use');
      }
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        name: dto.name ?? tenant.name,
        logoUrl:
          dto.logoUrl === undefined ? tenant.logoUrl : (dto.logoUrl ?? null),
        primaryColor: dto.primaryColor ?? tenant.primaryColor,
        accentColor: dto.accentColor ?? tenant.accentColor,
        textColor: dto.textColor ?? tenant.textColor,
        buttonColor: dto.buttonColor ?? tenant.buttonColor,
        fontStyle: dto.fontStyle ?? tenant.fontStyle,
        customDomain:
          dto.customDomain === undefined
            ? tenant.customDomain
            : (dto.customDomain ?? null),
        ...(dto.customDomain !== undefined &&
        dto.customDomain !== tenant.customDomain
          ? { customDomainVerified: false }
          : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        tenantId: tenant.id,
        action: 'TENANT_SETTINGS_UPDATED',
        entity: 'Tenant',
        entityId: tenant.id,
        oldValues: this.toPublic(tenant) as unknown as Prisma.InputJsonValue,
        newValues: this.toPublic(updated) as unknown as Prisma.InputJsonValue,
      },
    });

    await this.resolver.invalidateCache(updated.slug);

    return {
      message: 'Tenant settings updated successfully.',
      data: this.toPublic(updated),
    };
  }

  async uploadTenantLogo(userId: string, file: TenantLogoFile | undefined) {
    if (!file) {
      throw new BadRequestException(
        'Please choose a logo file before uploading.',
      );
    }

    this.validateLogoUpload(file);

    const membership = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, tenantId: true },
    });

    if (!membership) {
      throw new NotFoundException('User not found');
    }

    if (membership.role !== 'TENANT_ADMIN' || !membership.tenantId) {
      throw new ForbiddenException('Tenant admin access is required');
    }

    const tenant = await this.getTenantById(membership.tenantId);
    const upload = await this.storageService.uploadFile({
      filename: this.normalizeFilename(file.originalname),
      mimeType: file.mimetype,
      data: file.buffer,
      folder: `tenants/${tenant.slug}/branding`,
    });

    return {
      message: 'Logo uploaded successfully.',
      data: {
        url: upload.url,
        publicId: upload.publicId,
      },
    };
  }

  /** Returns safe public branding config for a tenant — used by frontend bootstrap. */
  toPublic(tenant: Tenant): TenantPublic {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor,
      accentColor: tenant.accentColor,
      textColor: tenant.textColor,
      buttonColor: tenant.buttonColor,
      fontStyle: tenant.fontStyle,
      customDomain: tenant.customDomain,
    };
  }

  private validateLogoUpload(file: TenantLogoFile) {
    if (!this.allowedLogoMimeTypes.has(file.mimetype)) {
      throw new BadRequestException(
        'Only JPG, JPEG, and PNG logo files are allowed.',
      );
    }

    if (file.size > this.maxLogoSizeBytes) {
      throw new BadRequestException('Logo files must be 2MB or smaller.');
    }

    if (!file.buffer?.length) {
      throw new BadRequestException(
        'The selected logo could not be processed. Please try again.',
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

  private async getTenantAdminTenantId(userId: string) {
    const membership = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, tenantId: true },
    });

    if (!membership) {
      throw new NotFoundException('User not found');
    }

    if (membership.role !== 'TENANT_ADMIN' || !membership.tenantId) {
      throw new ForbiddenException('Tenant admin access is required');
    }

    return membership.tenantId;
  }

  async updateTenantUserRoleForAdmin(
    adminUserId: string,
    targetUserId: string,
    nextRole: UserRole,
  ) {
    const tenantId = await this.getTenantAdminTenantId(adminUserId);

    if (
      nextRole === UserRole.SUPER_ADMIN ||
      nextRole === UserRole.TENANT_ADMIN
    ) {
      throw new BadRequestException(
        'Use the dedicated business-admin provisioning flow for admin access changes.',
      );
    }

    const targetUser = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        tenantId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        cbtProfile: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!targetUser) {
      throw new NotFoundException('Business user not found.');
    }

    if (targetUser.id === adminUserId) {
      throw new ForbiddenException('You cannot change your own role here.');
    }

    if (targetUser.role === 'TENANT_ADMIN') {
      throw new BadRequestException(
        'Business admin accounts are managed from the business-admin access flow.',
      );
    }

    if (String(targetUser.role) === String(nextRole)) {
      return {
        message: `${targetUser.firstName} ${targetUser.lastName} already has this role.`,
        data: {
          id: targetUser.id,
          role: targetUser.role,
        },
      };
    }

    if (nextRole === UserRole.CBT_CENTER && !targetUser.cbtProfile) {
      throw new BadRequestException(
        'Only users with a CBT profile can be moved into the CBT center role. Use the CBT registration flow first.',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: targetUser.id },
      data: {
        role: nextRole,
      },
      select: {
        id: true,
        role: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        tenantId,
        action: 'TENANT_USER_ROLE_UPDATED',
        entity: 'User',
        entityId: targetUser.id,
        oldValues: {
          role: targetUser.role,
          email: targetUser.email,
        },
        newValues: {
          role: nextRole,
          email: targetUser.email,
        },
      },
    });

    return {
      message: `${updatedUser.firstName} ${updatedUser.lastName} is now set as ${this.formatRoleLabel(nextRole)}.`,
      data: {
        ...updatedUser,
        createdAt: updatedUser.createdAt.toISOString(),
        lastLoginAt: updatedUser.lastLoginAt?.toISOString() ?? null,
      },
    };
  }

  async deleteTenantUserForAdmin(adminUserId: string, targetUserId: string) {
    const tenantId = await this.getTenantAdminTenantId(adminUserId);

    const targetUser = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        tenantId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('Business user not found.');
    }

    if (targetUser.id === adminUserId) {
      throw new ForbiddenException('You cannot delete your own account here.');
    }

    if (targetUser.role === 'TENANT_ADMIN') {
      throw new BadRequestException(
        'Business admin accounts must be managed from the business-admin access flow.',
      );
    }

    const [
      placedOrders,
      assignedOrders,
      transactions,
      withdrawals,
      disputesRaised,
      disputesResolved,
    ] = await Promise.all([
      this.prisma.order.count({ where: { requesterId: targetUser.id } }),
      this.prisma.order.count({ where: { assignedCbtId: targetUser.id } }),
      this.prisma.transaction.count({ where: { userId: targetUser.id } }),
      this.prisma.withdrawalRequest.count({ where: { userId: targetUser.id } }),
      this.prisma.dispute.count({ where: { raisedById: targetUser.id } }),
      this.prisma.dispute.count({ where: { resolvedById: targetUser.id } }),
    ]);

    const hasHistory =
      placedOrders > 0 ||
      assignedOrders > 0 ||
      transactions > 0 ||
      withdrawals > 0 ||
      disputesRaised > 0 ||
      disputesResolved > 0;

    if (hasHistory) {
      throw new BadRequestException(
        'This user already has order or finance history, so the account cannot be deleted. You can still leave the account inactive.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.delete({
        where: { id: targetUser.id },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: adminUserId,
          tenantId,
          action: 'TENANT_USER_DELETED',
          entity: 'User',
          entityId: targetUser.id,
          oldValues: {
            role: targetUser.role,
            email: targetUser.email,
          },
        },
      }),
    ]);

    return {
      message: `${targetUser.firstName} ${targetUser.lastName} was removed from this business.`,
      data: { id: targetUser.id },
    };
  }

  private formatRoleLabel(role: UserRole) {
    switch (role) {
      case UserRole.CBT_CENTER:
        return 'CBT center';
      case UserRole.INDIVIDUAL:
        return 'individual user';
      case UserRole.TENANT_ADMIN:
        return 'business admin';
      case UserRole.SUPER_ADMIN:
        return 'platform admin';
      default:
        return 'user';
    }
  }
}
