import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { resolveTxt } from 'node:dns/promises';
import * as bcrypt from 'bcryptjs';
import { Prisma, Tenant } from '@prisma/client';
import { ProviderCredentialsService } from '../../providers/provider-credentials.service';
import { StorageService } from '../../providers/storage/storage.service';
import { EmailService } from '../../providers/email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  TenantAdminPermission,
  TENANT_ADMIN_PERMISSIONS,
  TENANT_HOMEPAGE_TEMPLATES,
  TenantHomepageStep,
  TenantPublic,
  UserRole,
} from '@zendocx/types';
import { TenantResolverService } from './tenant-resolver.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CreateTenantAdminDto } from './dto/create-tenant-admin.dto';
import { CreateOwnTenantAdminDto } from './dto/create-own-tenant-admin.dto';
import { GetTenantUsersDto } from './dto/get-tenant-users.dto';
import { UpdateOwnTenantSettingsDto } from './dto/update-own-tenant-settings.dto';
import { UpdateOwnTenantAdminDto } from './dto/update-own-tenant-admin.dto';

type TenantLogoFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type TenantDomainVerificationData = {
  customDomain: string;
  customDomainVerified: boolean;
  recordType: 'TXT';
  recordHost: string;
  recordValue: string;
  verificationStatus:
    | 'VERIFIED'
    | 'READY_TO_VERIFY'
    | 'DNS_RECORD_NOT_FOUND'
    | 'DNS_RECORD_MISMATCH'
    | 'DNS_LOOKUP_ERROR'
    | 'SERVICE_NOT_CONFIGURED';
  verificationService: {
    secretSource:
      | 'DOMAIN_VERIFICATION_SECRET'
      | 'JWT_ACCESS_SECRET'
      | 'JWT_SECRET'
      | 'DEFAULT_FALLBACK';
    dedicatedSecretConfigured: boolean;
    canVerifyReliably: boolean;
    message: string;
  };
  dnsLookup: {
    checkedAt: string | null;
    expectedValueFound: boolean;
    recordsFound: string[];
    errorCode: string | null;
    errorMessage: string | null;
  };
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
    private readonly emailService: EmailService,
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

  private normalizeCustomDomain(
    value: string | null | undefined,
  ): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/\.$/, '');
    return normalized || null;
  }

  private getDomainVerificationSecretConfig(): {
    value: string;
    source:
      | 'DOMAIN_VERIFICATION_SECRET'
      | 'JWT_ACCESS_SECRET'
      | 'JWT_SECRET'
      | 'DEFAULT_FALLBACK';
    dedicatedSecretConfigured: boolean;
  } {
    const dedicatedSecret = this.config
      .get<string>('DOMAIN_VERIFICATION_SECRET')
      ?.trim();
    if (dedicatedSecret) {
      return {
        value: dedicatedSecret,
        source: 'DOMAIN_VERIFICATION_SECRET',
        dedicatedSecretConfigured: true,
      };
    }

    const jwtAccessSecret = this.config.get<string>('JWT_ACCESS_SECRET')?.trim();
    if (jwtAccessSecret) {
      return {
        value: jwtAccessSecret,
        source: 'JWT_ACCESS_SECRET',
        dedicatedSecretConfigured: false,
      };
    }

    const jwtSecret = this.config.get<string>('JWT_SECRET')?.trim();
    if (jwtSecret) {
      return {
        value: jwtSecret,
        source: 'JWT_SECRET',
        dedicatedSecretConfigured: false,
      };
    }

    return {
      value: 'zendocx-domain-verification-secret',
      source: 'DEFAULT_FALLBACK',
      dedicatedSecretConfigured: false,
    };
  }

  private buildDomainVerificationData(
    tenant: Tenant,
  ): TenantDomainVerificationData | null {
    const customDomain = this.normalizeCustomDomain(tenant.customDomain);

    if (!customDomain) {
      return null;
    }

    const secretConfig = this.getDomainVerificationSecretConfig();
    const recordValue = createHmac('sha256', secretConfig.value)
      .update(`${tenant.id}:${customDomain}`)
      .digest('base64url')
      .slice(0, 32);

    const verificationServiceMessage = secretConfig.dedicatedSecretConfigured
      ? 'The platform verification secret is configured and ready for production domain checks.'
      : secretConfig.source === 'JWT_ACCESS_SECRET' ||
          secretConfig.source === 'JWT_SECRET'
        ? 'Domain verification can run, but the platform is still reusing a JWT secret. Set DOMAIN_VERIFICATION_SECRET in production to decouple DNS verification from auth secret rotation.'
        : 'The platform is using a local fallback verification secret. Set DOMAIN_VERIFICATION_SECRET before relying on custom domains in production.';

    return {
      customDomain,
      customDomainVerified: tenant.customDomainVerified,
      recordType: 'TXT',
      recordHost: `_zendocx-verify.${customDomain}`,
      recordValue: `zendocx-site-verification=${recordValue}`,
      verificationStatus: tenant.customDomainVerified
        ? 'VERIFIED'
        : secretConfig.source === 'DEFAULT_FALLBACK'
          ? 'SERVICE_NOT_CONFIGURED'
          : 'READY_TO_VERIFY',
      verificationService: {
        secretSource: secretConfig.source,
        dedicatedSecretConfigured: secretConfig.dedicatedSecretConfigured,
        canVerifyReliably: secretConfig.source !== 'DEFAULT_FALLBACK',
        message: verificationServiceMessage,
      },
      dnsLookup: {
        checkedAt: null,
        expectedValueFound: false,
        recordsFound: [],
        errorCode: null,
        errorMessage: null,
      },
    };
  }

  private async resolveTxtRecords(hostname: string): Promise<string[]> {
    const records = await resolveTxt(hostname);
    return records.flat().map((entry) => entry.trim()).filter(Boolean);
  }

  private async inspectDomainVerification(
    tenant: Tenant,
  ): Promise<TenantDomainVerificationData | null> {
    const verification = this.buildDomainVerificationData(tenant);

    if (!verification) {
      return null;
    }

    if (!verification.verificationService.canVerifyReliably) {
      return verification;
    }

    const checkedAt = new Date().toISOString();

    try {
      const recordsFound = await this.resolveTxtRecords(verification.recordHost);
      const expectedValueFound = recordsFound.includes(verification.recordValue);

      return {
        ...verification,
        verificationStatus: tenant.customDomainVerified
          ? 'VERIFIED'
          : expectedValueFound
            ? 'READY_TO_VERIFY'
            : recordsFound.length
              ? 'DNS_RECORD_MISMATCH'
              : 'DNS_RECORD_NOT_FOUND',
        dnsLookup: {
          checkedAt,
          expectedValueFound,
          recordsFound,
          errorCode: null,
          errorMessage: null,
        },
      };
    } catch (error) {
      const errorCode =
        typeof error === 'object' && error && 'code' in error
          ? String((error as { code?: string }).code ?? '')
          : '';
      const errorMessage =
        error instanceof Error ? error.message : 'DNS lookup failed';

      return {
        ...verification,
        verificationStatus: tenant.customDomainVerified
          ? 'VERIFIED'
          : 'DNS_LOOKUP_ERROR',
        dnsLookup: {
          checkedAt,
          expectedValueFound: false,
          recordsFound: [],
          errorCode: errorCode || null,
          errorMessage,
        },
      };
    }
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

  private getDefaultHomepageManualSteps(): TenantHomepageStep[] {
    return [
      {
        title: 'Choose a service',
        description:
          'Pick the exact document or verification service you need before you sign in or create an account.',
      },
      {
        title: 'Submit the required details',
        description:
          'Complete the request form, upload any required documents, and confirm the request from the business portal.',
      },
      {
        title: 'Track the manual processing',
        description:
          'Follow status updates from the business dashboard until the request is completed and the result is ready.',
      },
    ];
  }

  private sanitizeHomepageManualSteps(value: Prisma.JsonValue | null | undefined) {
    if (!Array.isArray(value)) {
      return this.getDefaultHomepageManualSteps();
    }

    const normalized = value
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const record = item as Record<string, unknown>;
        const title = String(record.title ?? '').trim();
        const description = String(record.description ?? '').trim();

        if (!title || !description) {
          return null;
        }

        return { title, description };
      })
      .filter((item): item is TenantHomepageStep => Boolean(item))
      .slice(0, 4);

    return normalized.length ? normalized : this.getDefaultHomepageManualSteps();
  }

  private normalizeTenantAdminPermissions(
    value: Prisma.JsonValue | readonly string[] | null | undefined,
  ): TenantAdminPermission[] {
    const input = Array.isArray(value) ? value : [];
    const allowed = new Set<string>(TENANT_ADMIN_PERMISSIONS);

    return Array.from(
      new Set(
        input
          .map((item) => String(item).trim())
          .filter((item): item is TenantAdminPermission => allowed.has(item)),
      ),
    );
  }

  private getEffectiveTenantAdminPermissions(
    value: Prisma.JsonValue | readonly string[] | null | undefined,
  ): TenantAdminPermission[] {
    const explicitPermissions = this.normalizeTenantAdminPermissions(value);
    return explicitPermissions.length
      ? explicitPermissions
      : [...TENANT_ADMIN_PERMISSIONS];
  }

  private async getTenantAdminAccessContext(userId: string) {
    const membership = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        tenantId: true,
        adminPermissions: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('User not found');
    }

    if (membership.role !== UserRole.TENANT_ADMIN || !membership.tenantId) {
      throw new ForbiddenException('Tenant admin access is required');
    }

    return {
      tenantId: membership.tenantId,
      permissions: this.getEffectiveTenantAdminPermissions(
        membership.adminPermissions,
      ),
    };
  }

  private async assertTenantAdminPermission(
    userId: string,
    permission: TenantAdminPermission,
  ) {
    const context = await this.getTenantAdminAccessContext(userId);

    if (!context.permissions.includes(permission)) {
      throw new ForbiddenException(
        'This business admin account does not have permission for that action.',
      );
    }

    return context;
  }

  async createTenant(
    dto: CreateTenantDto,
    createdById: string,
  ): Promise<Tenant> {
    const customDomain = this.normalizeCustomDomain(dto.customDomain);
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });
    if (existing)
      throw new ConflictException(`Tenant slug "${dto.slug}" is already taken`);

    if (customDomain) {
      const domainConflict = await this.prisma.tenant.findUnique({
        where: { customDomain },
      });
      if (domainConflict)
        throw new ConflictException(
          `Custom domain "${customDomain}" is already in use`,
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
        homepageTemplate: TENANT_HOMEPAGE_TEMPLATES[0],
        homepageHeading: `Access ${dto.name} from one business portal`,
        homepageSubheading:
          'Start with the public business homepage, review available services, then sign in or create your account when you are ready.',
        homepageAbout:
          `${dto.name} uses ZenDocx to manage service requests, customer onboarding, and manual document workflows from one tenant-owned workspace.`,
        homepageManualSteps:
          this.getDefaultHomepageManualSteps() as unknown as Prisma.InputJsonValue,
        tenantMarginRate: dto.tenantMarginRate ?? 0,
        customDomain: customDomain ?? null,
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
        this.prisma.user.count({
          where: { role: { in: [UserRole.INDIVIDUAL, UserRole.CBT_CENTER] } },
        }),
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
    const customDomain = this.normalizeCustomDomain(dto.customDomain);
    const nextCustomDomain =
      customDomain === undefined ? tenant.customDomain : customDomain;

    if (
      customDomain !== undefined &&
      customDomain !== tenant.customDomain
    ) {
      if (customDomain !== null) {
        const conflict = await this.prisma.tenant.findUnique({
          where: { customDomain },
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
      data: {
        ...dto,
        customDomain: nextCustomDomain,
      },
    });

    // Invalidate resolver cache
    await this.resolver.invalidateCache({
      slug: updated.slug,
      customDomains: [tenant.customDomain, updated.customDomain],
    });

    return updated;
  }

  async getOwnTenantDomainVerification(userId: string) {
    const membership = await this.assertTenantAdminPermission(
      userId,
      'MANAGE_BUSINESS_SETTINGS',
    );
    const tenant = await this.getTenantById(membership.tenantId);
    const verification = await this.inspectDomainVerification(tenant);

    if (!verification) {
      throw new BadRequestException(
        'Save a custom domain before requesting verification instructions.',
      );
    }

    return {
      message: 'Custom domain verification details retrieved.',
      data: verification,
    };
  }

  async verifyOwnTenantCustomDomain(userId: string) {
    const membership = await this.assertTenantAdminPermission(
      userId,
      'MANAGE_BUSINESS_SETTINGS',
    );
    const tenant = await this.getTenantById(membership.tenantId);
    const verification = await this.inspectDomainVerification(tenant);

    if (!verification) {
      throw new BadRequestException(
        'Save a custom domain before verifying it.',
      );
    }

    if (!verification.verificationService.canVerifyReliably) {
      throw new InternalServerErrorException(
        'The platform verification service is not configured for reliable production checks yet. Ask a platform operator to set DOMAIN_VERIFICATION_SECRET and try again.',
      );
    }

    if (!verification.dnsLookup.expectedValueFound) {
      if (verification.verificationStatus === 'DNS_RECORD_NOT_FOUND') {
        throw new BadRequestException(
          'We could not find the expected TXT record yet. Double-check the host and value, then try again.',
        );
      }

      if (verification.verificationStatus === 'DNS_RECORD_MISMATCH') {
        throw new BadRequestException(
          'A TXT record was found, but the value does not match the expected verification token yet.',
        );
      }

      if (verification.verificationStatus === 'DNS_LOOKUP_ERROR') {
        throw new InternalServerErrorException(
          'We could not complete the DNS lookup right now. Please try again shortly.',
        );
      }
    }

    const updatedTenant =
      tenant.customDomainVerified
        ? tenant
        : await this.prisma.tenant.update({
            where: { id: tenant.id },
            data: { customDomainVerified: true },
          });

    await this.prisma.auditLog.create({
      data: {
        userId,
        tenantId: tenant.id,
        action: 'CUSTOM_DOMAIN_VERIFIED',
        entity: 'Tenant',
        entityId: tenant.id,
        oldValues: this.toPublic(tenant) as unknown as Prisma.InputJsonValue,
        newValues:
          this.toPublic(updatedTenant) as unknown as Prisma.InputJsonValue,
      },
    });

    await this.resolver.invalidateCache({
      slug: updatedTenant.slug,
      customDomains: [updatedTenant.customDomain],
    });

    return {
      message: 'Custom domain verified successfully.',
      data: {
        tenant: this.toPublic(updatedTenant),
        verification: await this.inspectDomainVerification(updatedTenant),
      },
    };
  }

  private async createTenantAdminAccount(
    tenantId: string,
    dto: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      permissions?: readonly string[];
    },
    createdById: string,
  ) {
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
    if (existingEmail) {
      throw new ConflictException('Email is already registered');
    }
    if (existingPhone) {
      throw new ConflictException('Phone number is already registered');
    }

    const tempPassword = this.generateTemporaryPassword();
    const rounds = Number(this.config.get('BCRYPT_ROUNDS', '12'));
    const passwordHash = await bcrypt.hash(tempPassword, rounds);
    const permissions = this.getEffectiveTenantAdminPermissions(
      dto.permissions ?? [],
    );

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          email: dto.email.toLowerCase(),
          phone: dto.phone.trim(),
          passwordHash,
          role: UserRole.TENANT_ADMIN,
          tenantId,
          adminPermissions: permissions as unknown as Prisma.InputJsonValue,
          isEmailVerified: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          tenantId: true,
          isActive: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          createdAt: true,
          lastLoginAt: true,
          adminPermissions: true,
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
            permissions,
          },
        },
      });

      return created;
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, slug: true },
    });

    if (tenant) {
      const frontendUrl =
        this.config.get<string>('FRONTEND_URL') ?? 'https://app.zendocx.net';
      const loginUrl = `${frontendUrl}/login`;

      await this.emailService
        .sendEmail({
          to: user.email,
          subject: `Your ${tenant.name} portal account is ready`,
          html: this.buildTenantWelcomeEmailHtml({
            firstName: user.firstName,
            tenantName: tenant.name,
            email: user.email,
            tempPassword,
            loginUrl,
          }),
          text: [
            `Hi ${user.firstName},`,
            '',
            `Your admin account for ${tenant.name} on ZenDocx has been created.`,
            '',
            `Email: ${user.email}`,
            `Temporary password: ${tempPassword}`,
            '',
            `Sign in at: ${loginUrl}`,
            '',
            'Please change your password immediately after your first login.',
          ].join('\n'),
        })
        .catch(() => undefined);
    }

    return {
      user: {
        ...user,
        adminPermissions: this.getEffectiveTenantAdminPermissions(
          user.adminPermissions,
        ),
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      },
      tempPassword,
    };
  }

  async createTenantAdmin(
    tenantId: string,
    dto: CreateTenantAdminDto,
    createdById: string,
  ) {
    const tenant = await this.getTenantById(tenantId);
    const created = await this.createTenantAdminAccount(tenantId, dto, createdById);

    return {
      message: `Tenant admin created for "${tenant.name}". Share the temporary password securely and remove the saved access when handoff is complete.`,
      data: {
        ...created.user,
        tempPassword: created.tempPassword,
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

  async createTenantAdminForAdmin(
    userId: string,
    dto: CreateOwnTenantAdminDto,
  ) {
    const membership = await this.assertTenantAdminPermission(
      userId,
      'MANAGE_BUSINESS_ADMINS',
    );
    const tenant = await this.getTenantById(membership.tenantId);
    const created = await this.createTenantAdminAccount(
      membership.tenantId,
      dto,
      userId,
    );

    return {
      message: `Business admin created for "${tenant.name}". Share the temporary password securely and encourage an immediate password change.`,
      data: {
        ...created.user,
        tempPassword: created.tempPassword,
      },
    };
  }

  async updateTenantAdminForAdmin(
    userId: string,
    targetUserId: string,
    dto: UpdateOwnTenantAdminDto,
  ) {
    const membership = await this.assertTenantAdminPermission(
      userId,
      'MANAGE_BUSINESS_ADMINS',
    );

    const targetUser = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        tenantId: membership.tenantId,
        role: UserRole.TENANT_ADMIN,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        adminPermissions: true,
        isEmailVerified: true,
        isPhoneVerified: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('Business admin not found.');
    }

    if (targetUser.id === userId && dto.isActive === false) {
      throw new ForbiddenException('You cannot disable your own admin access.');
    }

    const nextPermissions =
      dto.permissions !== undefined
        ? this.getEffectiveTenantAdminPermissions(dto.permissions)
        : this.getEffectiveTenantAdminPermissions(targetUser.adminPermissions);
    const nextIsActive = dto.isActive ?? targetUser.isActive;

    const updated = await this.prisma.user.update({
      where: { id: targetUser.id },
      data: {
        adminPermissions:
          nextPermissions as unknown as Prisma.InputJsonValue,
        isActive: nextIsActive,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        createdAt: true,
        lastLoginAt: true,
        adminPermissions: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        tenantId: membership.tenantId,
        action: 'TENANT_ADMIN_UPDATED',
        entity: 'User',
        entityId: targetUser.id,
        oldValues: {
          isActive: targetUser.isActive,
          permissions: this.getEffectiveTenantAdminPermissions(
            targetUser.adminPermissions,
          ),
        },
        newValues: {
          isActive: nextIsActive,
          permissions: nextPermissions,
        },
      },
    });

    return {
      message: `${updated.firstName} ${updated.lastName} has been updated.`,
      data: {
        ...updated,
        adminPermissions: this.getEffectiveTenantAdminPermissions(
          updated.adminPermissions,
        ),
        createdAt: updated.createdAt.toISOString(),
        lastLoginAt: updated.lastLoginAt?.toISOString() ?? null,
      },
    };
  }

  async deleteTenantAdminForAdmin(userId: string, targetUserId: string) {
    const membership = await this.assertTenantAdminPermission(
      userId,
      'MANAGE_BUSINESS_ADMINS',
    );

    const targetUser = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        tenantId: membership.tenantId,
        role: UserRole.TENANT_ADMIN,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('Business admin not found.');
    }

    if (targetUser.id === userId) {
      throw new ForbiddenException('You cannot delete your own admin account.');
    }

    const adminCount = await this.prisma.user.count({
      where: {
        tenantId: membership.tenantId,
        role: UserRole.TENANT_ADMIN,
      },
    });

    if (adminCount <= 1) {
      throw new BadRequestException(
        'This business must keep at least one business admin account.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.tenantAdminAccess.updateMany({
        where: {
          tenantId: membership.tenantId,
          userId: targetUser.id,
          isActive: true,
        },
        data: {
          isActive: false,
          dismissedAt: new Date(),
        },
      }),
      this.prisma.user.delete({
        where: { id: targetUser.id },
      }),
      this.prisma.auditLog.create({
        data: {
          userId,
          tenantId: membership.tenantId,
          action: 'TENANT_ADMIN_DELETED',
          entity: 'User',
          entityId: targetUser.id,
          oldValues: {
            email: targetUser.email,
            role: UserRole.TENANT_ADMIN,
          },
        },
      }),
    ]);

    return {
      message: `${targetUser.firstName} ${targetUser.lastName} has been removed from business admin access.`,
      data: { id: targetUser.id },
    };
  }

  async getTenantOverviewForAdmin(userId: string) {
    const membership = await this.getTenantAdminAccessContext(userId);
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
    const membership = await this.getTenantAdminAccessContext(userId);

    if (
      query.role === UserRole.INDIVIDUAL &&
      !membership.permissions.includes('MANAGE_USERS')
    ) {
      throw new ForbiddenException(
        'This business admin account cannot manage customer users.',
      );
    }

    if (
      query.role === UserRole.TENANT_ADMIN &&
      !membership.permissions.includes('MANAGE_BUSINESS_ADMINS')
    ) {
      throw new ForbiddenException(
        'This business admin account cannot manage business admins.',
      );
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
          adminPermissions: true,
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
          adminPermissions:
            user.role === UserRole.TENANT_ADMIN
              ? this.getEffectiveTenantAdminPermissions(user.adminPermissions)
              : undefined,
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
          adminPermissions: true,
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
          adminPermissions:
            user.role === UserRole.TENANT_ADMIN
              ? this.getEffectiveTenantAdminPermissions(user.adminPermissions)
              : undefined,
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
    const membership = await this.assertTenantAdminPermission(
      userId,
      'MANAGE_BUSINESS_SETTINGS',
    );

    const tenant = await this.getTenantById(membership.tenantId);
    const customDomain = this.normalizeCustomDomain(dto.customDomain);
    const nextCustomDomain =
      customDomain === undefined ? tenant.customDomain : customDomain;

    if (
      customDomain !== undefined &&
      customDomain !== tenant.customDomain &&
      customDomain !== null
    ) {
      const conflict = await this.prisma.tenant.findUnique({
        where: { customDomain },
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
        homepageTemplate: dto.homepageTemplate ?? tenant.homepageTemplate,
        homepageHeading:
          dto.homepageHeading === undefined
            ? tenant.homepageHeading
            : (dto.homepageHeading ?? null),
        homepageSubheading:
          dto.homepageSubheading === undefined
            ? tenant.homepageSubheading
            : (dto.homepageSubheading ?? null),
        homepageAbout:
          dto.homepageAbout === undefined
            ? tenant.homepageAbout
            : (dto.homepageAbout ?? null),
        homepageManualSteps:
          dto.homepageManualSteps === undefined
          ? (tenant.homepageManualSteps as Prisma.InputJsonValue)
          : (dto.homepageManualSteps as unknown as Prisma.InputJsonValue),
        customDomain: nextCustomDomain,
        ...(customDomain !== undefined &&
        customDomain !== tenant.customDomain
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

    await this.resolver.invalidateCache({
      slug: updated.slug,
      customDomains: [tenant.customDomain, updated.customDomain],
    });

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

    const membership = await this.assertTenantAdminPermission(
      userId,
      'MANAGE_BUSINESS_SETTINGS',
    );

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
      customDomainVerified: tenant.customDomainVerified,
      homepageTemplate: (
        TENANT_HOMEPAGE_TEMPLATES.includes(
          tenant.homepageTemplate as (typeof TENANT_HOMEPAGE_TEMPLATES)[number],
        )
          ? tenant.homepageTemplate
          : TENANT_HOMEPAGE_TEMPLATES[0]
      ) as TenantPublic['homepageTemplate'],
      homepageHeading:
        tenant.homepageHeading ??
        `Access ${tenant.name} from one business portal`,
      homepageSubheading:
        tenant.homepageSubheading ??
        'Review the available services, understand the process, and sign in when you are ready to continue.',
      homepageAbout:
        tenant.homepageAbout ??
        `${tenant.name} uses ZenDocx to manage customer requests, document processing, and service operations from one tenant-owned workspace.`,
      homepageManualSteps: this.sanitizeHomepageManualSteps(
        tenant.homepageManualSteps,
      ),
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

  private buildTenantWelcomeEmailHtml(input: {
    firstName: string;
    tenantName: string;
    email: string;
    tempPassword: string;
    loginUrl: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f8fc;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fc;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:24px;border:1px solid rgba(15,23,42,0.07);box-shadow:0 4px 24px rgba(15,23,42,0.06)">
        <tr><td style="background:#0D1B3E;border-radius:24px 24px 0 0;padding:32px 40px;text-align:center">
          <span style="color:#F5A623;font-size:28px;font-weight:900;letter-spacing:-0.5px">ZenDocx</span>
        </td></tr>
        <tr><td style="padding:40px">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.3px">Welcome to ZenDocx, ${input.firstName}!</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6">Your business workspace <strong>${input.tenantName}</strong> has been created. Use the credentials below to sign in and set up your portal.</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:20px 24px;margin-bottom:28px">
            <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Your login details</p>
            <p style="margin:0 0 4px;font-size:14px;color:#0f172a"><strong>Email:</strong> ${input.email}</p>
            <p style="margin:0;font-size:14px;color:#0f172a"><strong>Temporary password:</strong> <span style="font-family:monospace;background:#f1f5f9;padding:2px 8px;border-radius:6px">${input.tempPassword}</span></p>
          </div>
          <div style="text-align:center;margin-bottom:28px">
            <a href="${input.loginUrl}" style="display:inline-block;background:#F5A623;color:#0D1B3E;text-decoration:none;font-weight:800;font-size:15px;padding:14px 32px;border-radius:16px">Sign in to your portal</a>
          </div>
          <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6">For security, please change your password immediately after your first login. Do not share these credentials with anyone.</p>
        </td></tr>
        <tr><td style="padding:20px 40px 32px;border-top:1px solid #f1f5f9;text-align:center">
          <p style="margin:0;font-size:12px;color:#cbd5e1">Fast. Trusted. Government Services, Simplified.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }
}
