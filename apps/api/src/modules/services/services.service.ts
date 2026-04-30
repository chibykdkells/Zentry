import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  FulfillmentType,
  Prisma,
  ProviderRolloutMode,
  ServiceDeliveryMode,
} from '@prisma/client';
import { nairaToKobo } from '@zendocx/utils';
import { GetServiceCatalogQueryDto } from './dto/get-service-catalog.dto';
import { UpdateVtuProviderConfigDto } from './dto/update-vtu-provider-config.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { GetAdminServicesQueryDto } from './dto/get-admin-services.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ProviderCredentialsService } from '../../providers/provider-credentials.service';
import { VtuService } from '../../providers/vtu/vtu.service';
import { RedisService } from '../redis/redis.service';

type RequiredFieldDefinition = {
  name: string;
  label?: string;
  type?: 'text' | 'textarea' | 'number' | 'email' | 'tel' | 'select';
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
};

type RequiredDocumentDefinition = {
  name: string;
  label?: string;
  required?: boolean;
  acceptedTypes?: string[];
  description?: string;
};

type VtuIntegrationMeta = {
  name: string;
  mode: 'live' | 'mock';
  cached: boolean;
};

const REQUIRED_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'email',
  'tel',
  'select',
] as const;

type RequiredFieldType = (typeof REQUIRED_FIELD_TYPES)[number];

type CableVerificationResponseData = {
  success: boolean;
  provider: string;
  smartcardNumber: string;
  customerName: string;
  currentPlan?: string;
  dueDate?: string;
  status: 'VALID' | 'INVALID';
  integration: VtuIntegrationMeta;
};

type ElectricityVerificationResponseData = {
  success: boolean;
  disco: string;
  meterNumber: string;
  meterType: 'PREPAID' | 'POSTPAID';
  customerName: string;
  address?: string;
  status: 'VALID' | 'INVALID';
  integration: VtuIntegrationMeta;
};

const PLATFORM_PROVIDER_SCOPE = {
  scopeType: 'PLATFORM' as const,
  scopeKey: 'platform',
  label: 'Platform default',
  tenantId: null as string | null,
};

type ProviderScopeContext = {
  scopeType: 'PLATFORM' | 'TENANT';
  scopeKey: string;
  label: string;
  tenantId: string | null;
};

@Injectable()
export class ServicesService {
  private static readonly VTU_PLAN_CACHE_TTL_SECONDS = 300;
  private static readonly VTU_VERIFICATION_CACHE_TTL_SECONDS = 120;

  constructor(
    private readonly prisma: PrismaService,
    private readonly vtuService: VtuService,
    private readonly redisService: RedisService,
    private readonly providerCredentialsService: ProviderCredentialsService,
  ) {}

  async getAdminCategories() {
    const categories = await this.prisma.serviceCategoryModel.findMany({
      where: { tenantId: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        isActive: true,
        sortOrder: true,
        _count: {
          select: {
            services: true,
          },
        },
      },
    });

    return {
      message: 'Admin categories retrieved',
      data: categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        isActive: category.isActive,
        sortOrder: category.sortOrder,
        serviceCount: category._count.services,
      })),
    };
  }

  async getProviderReadiness() {
    return this.getScopedProviderReadiness(PLATFORM_PROVIDER_SCOPE);
  }

  async getTenantProviderReadiness(tenantId: string) {
    return this.getScopedProviderReadiness({
      scopeType: 'TENANT',
      scopeKey: tenantId,
      label: 'Tenant override',
      tenantId,
    });
  }

  async getTenantServiceManagementCatalog(
    tenantId: string,
    query: GetServiceCatalogQueryDto,
  ) {
    const trimmedSearch = query.search?.trim();
    const tenantFilter = this.buildServiceVisibilityFilter(tenantId);
    const categoryTenantFilter = this.buildCategoryVisibilityFilter(tenantId);
    const where: Prisma.ServiceWhereInput = {
      isActive: true,
      ...tenantFilter,
      ...(query.categorySlug ? { category: { slug: query.categorySlug } } : {}),
      ...(trimmedSearch
        ? {
            OR: [
              {
                name: {
                  contains: trimmedSearch,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                description: {
                  contains: trimmedSearch,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                category: {
                  name: {
                    contains: trimmedSearch,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [selectionState, categories, services] = await Promise.all([
      this.getTenantServiceSelectionState(tenantId),
      this.prisma.serviceCategoryModel.findMany({
        where: { isActive: true, ...categoryTenantFilter },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          tenantId: true,
          name: true,
          slug: true,
          description: true,
        },
      }),
      this.prisma.service.findMany({
        where,
        orderBy: [
          { category: { sortOrder: 'asc' } },
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
        select: {
          id: true,
          tenantId: true,
          name: true,
          slug: true,
          description: true,
          deliveryMode: true,
          fulfillmentType: true,
          totalPrice: true,
          cbtCommission: true,
          requiredFields: true,
          requiredDocuments: true,
          category: {
            select: {
              id: true,
              tenantId: true,
              name: true,
              slug: true,
              description: true,
            },
          },
        },
      }),
    ]);

    const visibleServices = this.dedupeTenantScopedBySlug(services, tenantId);
    const visibleCategories = this.buildCatalogCategories(
      categories,
      visibleServices,
      tenantId,
    );
    const selectedSlugs = selectionState.selectedServiceSlugs;

    return {
      message: 'Tenant service management catalog retrieved',
      data: {
        selection: {
          usesCustomSelection: selectionState.usesCustomSelection,
          selectedServiceSlugs: Array.from(selectedSlugs),
          selectedCount: selectionState.usesCustomSelection
            ? selectedSlugs.size
            : visibleServices.length,
          visibleCount: visibleServices.length,
        },
        categories: visibleCategories.map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          serviceCount: category.serviceCount,
        })),
        services: visibleServices.map((service) => ({
          id: service.id,
          name: service.name,
          slug: service.slug,
          description: service.description,
          deliveryMode: service.deliveryMode,
          fulfillmentType: service.fulfillmentType,
          totalPrice: service.totalPrice.toString(),
          cbtCommission: service.cbtCommission.toString(),
          requiredFieldsCount: Array.isArray(service.requiredFields)
            ? service.requiredFields.length
            : 0,
          requiredDocumentsCount: Array.isArray(service.requiredDocuments)
            ? service.requiredDocuments.length
            : 0,
          eta: this.getEtaForDeliveryMode(service.deliveryMode),
          isSelected: selectionState.usesCustomSelection
            ? selectedSlugs.has(service.slug)
            : true,
          category: {
            id: service.category.id,
            name: service.category.name,
            slug: service.category.slug,
            description: service.category.description,
          },
        })),
        filters: {
          search: trimmedSearch ?? null,
          categorySlug: query.categorySlug ?? null,
        },
      },
    };
  }

  async updateTenantServiceSelection(
    tenantId: string,
    input: {
      usesCustomSelection: boolean;
      selectedServiceSlugs: string[];
    },
  ) {
    const normalizedSlugs = Array.from(
      new Set(
        (input.selectedServiceSlugs ?? [])
          .map((slug) => slug.trim().toLowerCase())
          .filter(Boolean),
      ),
    );

    const visibleServices = this.dedupeTenantScopedBySlug(
      await this.prisma.service.findMany({
        where: {
          isActive: true,
          ...this.buildServiceVisibilityFilter(tenantId),
        },
        select: {
          slug: true,
          tenantId: true,
        },
      }),
      tenantId,
    );
    const visibleSlugs = new Set(
      visibleServices.map((service) => service.slug),
    );
    const invalidSlugs = normalizedSlugs.filter(
      (slug) => !visibleSlugs.has(slug),
    );

    if (invalidSlugs.length > 0) {
      throw new BadRequestException(
        `These services are not available to this business: ${invalidSlugs.join(', ')}`,
      );
    }

    if (input.usesCustomSelection && normalizedSlugs.length === 0) {
      throw new BadRequestException(
        'Choose at least one service before saving a custom service lineup.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          usesCustomServiceSelection: input.usesCustomSelection,
        },
      });

      await tx.tenantServiceSelection.deleteMany({
        where: { tenantId },
      });

      if (input.usesCustomSelection && normalizedSlugs.length > 0) {
        await tx.tenantServiceSelection.createMany({
          data: normalizedSlugs.map((serviceSlug) => ({
            tenantId,
            serviceSlug,
          })),
        });
      }
    });

    return this.getTenantServiceManagementCatalog(tenantId, {});
  }

  private async getScopedProviderReadiness(scope: ProviderScopeContext) {
    const savedConfig = await this.prisma.platformProviderConfig.findUnique({
      where: {
        providerType_providerKey_scopeType_scopeKey: {
          providerType: 'VTU',
          providerKey: 'PROVIDER_ONE',
          scopeType: scope.scopeType,
          scopeKey: scope.scopeKey,
        },
      },
      select: {
        scopeType: true,
        scopeKey: true,
        isEnabled: true,
        rolloutMode: true,
        baseUrl: true,
        apiKeyLast4: true,
        apiKeyEncrypted: true,
        apiKeyHeader: true,
        apiKeyPrefix: true,
        healthPath: true,
        airtimePath: true,
        dataPurchasePath: true,
        dataPlansPath: true,
        cablePlansPath: true,
        cableVerifyPath: true,
        cablePurchasePath: true,
        electricityVerifyPath: true,
        electricityPurchasePath: true,
        notes: true,
        lastValidatedAt: true,
        lastValidationStatus: true,
        lastValidationMessage: true,
      },
    });
    const validationHistory =
      await this.prisma.providerValidationEvent.findMany({
        where: {
          providerType: 'VTU',
          providerKey: 'PROVIDER_ONE',
          scopeType: scope.scopeType,
          scopeKey: scope.scopeKey,
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          rolloutMode: true,
          effectiveMode: true,
          probeStatus: true,
          probeMessage: true,
          missingConfig: true,
          endpointBaseUrl: true,
          createdAt: true,
        },
      });

    const automatedServices = await this.prisma.service.findMany({
      where: {
        ...this.buildServiceVisibilityFilter(scope.tenantId),
        deliveryMode: ServiceDeliveryMode.API_AUTOMATED,
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        slug: true,
        providerKey: true,
        category: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
    });

    const visibleAutomatedServices = scope.tenantId
      ? this.dedupeTenantScopedBySlug(automatedServices, scope.tenantId)
      : automatedServices;

    const readiness = await this.vtuService.getReadiness({
      tenantId: scope.tenantId,
    });

    return {
      message: 'Provider readiness retrieved',
      data: {
        vtu: readiness,
        scope: {
          type: scope.scopeType,
          key: scope.scopeKey,
          label: scope.label,
          tenantReady: true,
          effectiveType: readiness.resolvedScope.type,
          effectiveKey: readiness.resolvedScope.key,
        },
        savedConfig: savedConfig
          ? {
              scopeType: savedConfig.scopeType,
              scopeKey: savedConfig.scopeKey,
              isEnabled: savedConfig.isEnabled,
              rolloutMode: savedConfig.rolloutMode,
              baseUrl: savedConfig.baseUrl,
              apiKeyConfigured: Boolean(savedConfig.apiKeyEncrypted),
              apiKeyLast4: savedConfig.apiKeyLast4,
              apiKeyHeader: savedConfig.apiKeyHeader,
              apiKeyPrefix: savedConfig.apiKeyPrefix,
              healthPath: savedConfig.healthPath,
              airtimePath: savedConfig.airtimePath,
              dataPurchasePath: savedConfig.dataPurchasePath,
              dataPlansPath: savedConfig.dataPlansPath,
              cablePlansPath: savedConfig.cablePlansPath,
              cableVerifyPath: savedConfig.cableVerifyPath,
              cablePurchasePath: savedConfig.cablePurchasePath,
              electricityVerifyPath: savedConfig.electricityVerifyPath,
              electricityPurchasePath: savedConfig.electricityPurchasePath,
              notes: savedConfig.notes,
              lastValidatedAt: savedConfig.lastValidatedAt,
              lastValidationStatus: savedConfig.lastValidationStatus,
              lastValidationMessage: savedConfig.lastValidationMessage,
            }
          : null,
        validationHistory: validationHistory.map((event) => ({
          id: event.id,
          rolloutMode: event.rolloutMode,
          effectiveMode: event.effectiveMode,
          probeStatus: event.probeStatus,
          probeMessage: event.probeMessage,
          missingConfig: Array.isArray(event.missingConfig)
            ? event.missingConfig
            : [],
          endpointBaseUrl: event.endpointBaseUrl,
          createdAt: event.createdAt,
        })),
        cache: {
          planTtlSeconds: ServicesService.VTU_PLAN_CACHE_TTL_SECONDS,
          verificationTtlSeconds:
            ServicesService.VTU_VERIFICATION_CACHE_TTL_SECONDS,
        },
        automatedServices: visibleAutomatedServices.map((service) => ({
          id: service.id,
          name: service.name,
          slug: service.slug,
          providerKey: service.providerKey,
          category: service.category,
        })),
      },
    };
  }

  async updateVtuProviderConfig(dto: UpdateVtuProviderConfigDto) {
    return this.updateScopedVtuProviderConfig(dto, PLATFORM_PROVIDER_SCOPE);
  }

  async updateTenantVtuProviderConfig(
    tenantId: string,
    dto: UpdateVtuProviderConfigDto,
  ) {
    return this.updateScopedVtuProviderConfig(dto, {
      scopeType: 'TENANT',
      scopeKey: tenantId,
      label: 'Tenant override',
      tenantId,
    });
  }

  private async updateScopedVtuProviderConfig(
    dto: UpdateVtuProviderConfigDto,
    scope: ProviderScopeContext,
  ) {
    const existing = await this.prisma.platformProviderConfig.findUnique({
      where: {
        providerType_providerKey_scopeType_scopeKey: {
          providerType: 'VTU',
          providerKey: 'PROVIDER_ONE',
          scopeType: scope.scopeType,
          scopeKey: scope.scopeKey,
        },
      },
    });

    const apiKey = dto.apiKey?.trim();
    const updateData: Prisma.PlatformProviderConfigUncheckedUpdateInput = {
      ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
      ...(dto.rolloutMode
        ? { rolloutMode: dto.rolloutMode as ProviderRolloutMode }
        : {}),
      ...(dto.baseUrl !== undefined
        ? { baseUrl: this.normalizeNullableString(dto.baseUrl) }
        : {}),
      ...(dto.apiKeyHeader !== undefined
        ? { apiKeyHeader: this.normalizeNullableString(dto.apiKeyHeader) }
        : {}),
      ...(dto.apiKeyPrefix !== undefined
        ? { apiKeyPrefix: this.normalizeNullableString(dto.apiKeyPrefix) }
        : {}),
      ...(dto.healthPath !== undefined
        ? { healthPath: this.normalizePath(dto.healthPath) }
        : {}),
      ...(dto.airtimePath !== undefined
        ? { airtimePath: this.normalizePath(dto.airtimePath) }
        : {}),
      ...(dto.dataPurchasePath !== undefined
        ? { dataPurchasePath: this.normalizePath(dto.dataPurchasePath) }
        : {}),
      ...(dto.dataPlansPath !== undefined
        ? { dataPlansPath: this.normalizePath(dto.dataPlansPath) }
        : {}),
      ...(dto.cablePlansPath !== undefined
        ? { cablePlansPath: this.normalizePath(dto.cablePlansPath) }
        : {}),
      ...(dto.cableVerifyPath !== undefined
        ? { cableVerifyPath: this.normalizePath(dto.cableVerifyPath) }
        : {}),
      ...(dto.cablePurchasePath !== undefined
        ? { cablePurchasePath: this.normalizePath(dto.cablePurchasePath) }
        : {}),
      ...(dto.electricityVerifyPath !== undefined
        ? {
            electricityVerifyPath: this.normalizePath(
              dto.electricityVerifyPath,
            ),
          }
        : {}),
      ...(dto.electricityPurchasePath !== undefined
        ? {
            electricityPurchasePath: this.normalizePath(
              dto.electricityPurchasePath,
            ),
          }
        : {}),
      ...(dto.notes !== undefined
        ? { notes: this.normalizeNullableString(dto.notes) }
        : {}),
      lastValidatedAt: null,
      lastValidationStatus: null,
      lastValidationMessage: null,
    };

    if (apiKey) {
      updateData.apiKeyEncrypted =
        this.providerCredentialsService.encrypt(apiKey);
      updateData.apiKeyLast4 = this.providerCredentialsService.mask(apiKey);
    } else if (dto.clearApiKey) {
      updateData.apiKeyEncrypted = null;
      updateData.apiKeyLast4 = null;
    }

    await this.prisma.platformProviderConfig.upsert({
      where: {
        providerType_providerKey_scopeType_scopeKey: {
          providerType: 'VTU',
          providerKey: 'PROVIDER_ONE',
          scopeType: scope.scopeType,
          scopeKey: scope.scopeKey,
        },
      },
      update: updateData,
      create: {
        providerType: 'VTU',
        providerKey: 'PROVIDER_ONE',
        scopeType: scope.scopeType,
        scopeKey: scope.scopeKey,
        displayName:
          scope.scopeType === 'TENANT'
            ? 'Tenant VTU Provider One'
            : 'Provider One VTU',
        isEnabled: dto.isEnabled ?? existing?.isEnabled ?? true,
        rolloutMode:
          (dto.rolloutMode as ProviderRolloutMode | undefined) ??
          ProviderRolloutMode.AUTO,
        baseUrl:
          dto.baseUrl !== undefined
            ? this.normalizeNullableString(dto.baseUrl)
            : null,
        apiKeyEncrypted: apiKey
          ? this.providerCredentialsService.encrypt(apiKey)
          : null,
        apiKeyLast4: apiKey
          ? this.providerCredentialsService.mask(apiKey)
          : null,
        apiKeyHeader:
          dto.apiKeyHeader !== undefined
            ? this.normalizeNullableString(dto.apiKeyHeader)
            : null,
        apiKeyPrefix:
          dto.apiKeyPrefix !== undefined
            ? this.normalizeNullableString(dto.apiKeyPrefix)
            : null,
        healthPath:
          dto.healthPath !== undefined
            ? this.normalizePath(dto.healthPath)
            : null,
        airtimePath:
          dto.airtimePath !== undefined
            ? this.normalizePath(dto.airtimePath)
            : null,
        dataPurchasePath:
          dto.dataPurchasePath !== undefined
            ? this.normalizePath(dto.dataPurchasePath)
            : null,
        dataPlansPath:
          dto.dataPlansPath !== undefined
            ? this.normalizePath(dto.dataPlansPath)
            : null,
        cablePlansPath:
          dto.cablePlansPath !== undefined
            ? this.normalizePath(dto.cablePlansPath)
            : null,
        cableVerifyPath:
          dto.cableVerifyPath !== undefined
            ? this.normalizePath(dto.cableVerifyPath)
            : null,
        cablePurchasePath:
          dto.cablePurchasePath !== undefined
            ? this.normalizePath(dto.cablePurchasePath)
            : null,
        electricityVerifyPath:
          dto.electricityVerifyPath !== undefined
            ? this.normalizePath(dto.electricityVerifyPath)
            : null,
        electricityPurchasePath:
          dto.electricityPurchasePath !== undefined
            ? this.normalizePath(dto.electricityPurchasePath)
            : null,
        notes:
          dto.notes !== undefined
            ? this.normalizeNullableString(dto.notes)
            : null,
      },
    });

    const readiness = await this.getScopedProviderReadiness(scope);

    return {
      message: 'VTU provider settings updated successfully.',
      data: readiness.data,
    };
  }

  async validateVtuProviderConfig() {
    return this.validateScopedVtuProviderConfig(PLATFORM_PROVIDER_SCOPE);
  }

  async validateTenantVtuProviderConfig(tenantId: string) {
    return this.validateScopedVtuProviderConfig({
      scopeType: 'TENANT',
      scopeKey: tenantId,
      label: 'Tenant override',
      tenantId,
    });
  }

  private async validateScopedVtuProviderConfig(scope: ProviderScopeContext) {
    const readiness = await this.vtuService.getReadiness({
      tenantId: scope.tenantId,
    });
    const probeStatus = readiness.probe.status;
    const probeMessage = readiness.probe.message;

    const config = await this.prisma.platformProviderConfig.upsert({
      where: {
        providerType_providerKey_scopeType_scopeKey: {
          providerType: 'VTU',
          providerKey: 'PROVIDER_ONE',
          scopeType: scope.scopeType,
          scopeKey: scope.scopeKey,
        },
      },
      update: {
        lastValidatedAt: new Date(readiness.probe.checkedAt),
        lastValidationStatus: probeStatus,
        lastValidationMessage: probeMessage,
      },
      create: {
        providerType: 'VTU',
        providerKey: 'PROVIDER_ONE',
        scopeType: scope.scopeType,
        scopeKey: scope.scopeKey,
        displayName:
          scope.scopeType === 'TENANT'
            ? 'Tenant VTU Provider One'
            : 'Provider One VTU',
        lastValidatedAt: new Date(readiness.probe.checkedAt),
        lastValidationStatus: probeStatus,
        lastValidationMessage: probeMessage,
      },
      select: { id: true, rolloutMode: true, baseUrl: true },
    });

    await this.prisma.providerValidationEvent.create({
      data: {
        providerConfigId: config.id,
        providerType: 'VTU',
        providerKey: 'PROVIDER_ONE',
        scopeType: scope.scopeType,
        scopeKey: scope.scopeKey,
        rolloutMode: config.rolloutMode,
        effectiveMode: readiness.mode,
        probeStatus,
        probeMessage,
        missingConfig: readiness.missingConfig,
        endpointBaseUrl: config.baseUrl,
      },
    });

    const refreshed = await this.getScopedProviderReadiness(scope);

    return {
      message:
        probeStatus === 'healthy'
          ? 'VTU provider validation completed successfully.'
          : 'VTU provider validation completed with warnings.',
      data: refreshed.data,
    };
  }

  async getAdminServices(query: GetAdminServicesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const search = query.search?.trim();

    const where: Prisma.ServiceWhereInput = {
      tenantId: null,
      ...(typeof query.isActive === 'boolean'
        ? { isActive: query.isActive }
        : {}),
      ...(query.deliveryMode ? { deliveryMode: query.deliveryMode } : {}),
      ...(query.categorySlug ? { category: { slug: query.categorySlug } } : {}),
      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                slug: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                category: {
                  name: {
                    contains: search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
            ],
          }
        : {}),
    };

    const totalMatching = await this.prisma.service.count({ where });

    const [
      total,
      activeServices,
      manualServices,
      automatedServices,
      apiAutomatedServices,
      pinStockServices,
      categories,
      services,
    ] = await this.prisma.$transaction([
      this.prisma.service.count({ where: { tenantId: null } }),
      this.prisma.service.count({ where: { tenantId: null, isActive: true } }),
      this.prisma.service.count({
        where: { tenantId: null, fulfillmentType: FulfillmentType.MANUAL },
      }),
      this.prisma.service.count({
        where: { tenantId: null, fulfillmentType: FulfillmentType.AUTOMATED },
      }),
      this.prisma.service.count({
        where: {
          tenantId: null,
          deliveryMode: ServiceDeliveryMode.API_AUTOMATED,
        },
      }),
      this.prisma.service.count({
        where: { tenantId: null, deliveryMode: ServiceDeliveryMode.PIN_STOCK },
      }),
      this.prisma.serviceCategoryModel.findMany({
        where: { tenantId: null },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          _count: {
            select: { services: true },
          },
        },
      }),
      this.prisma.service.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          { category: { sortOrder: 'asc' } },
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          isActive: true,
          deliveryMode: true,
          fulfillmentType: true,
          providerCost: true,
          platformFee: true,
          totalPrice: true,
          cbtCommission: true,
          providerKey: true,
          providerServiceCode: true,
          sortOrder: true,
          requiredFields: true,
          requiredDocuments: true,
          createdAt: true,
          updatedAt: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
    ]);

    return {
      message: 'Admin services retrieved',
      data: {
        overview: {
          totalServices: total,
          activeServices,
          inactiveServices: total - activeServices,
          manualServices,
          automatedServices,
          apiAutomatedServices,
          pinStockServices,
          categories: categories.length,
        },
        categories: categories.map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          isActive: category.isActive,
          serviceCount: category._count.services,
        })),
        items: services.map((service) => this.mapServiceRecord(service)),
        pagination: {
          page,
          limit,
          total: totalMatching,
          totalPages: Math.max(1, Math.ceil(totalMatching / limit)),
        },
        filters: {
          search: search ?? null,
          categorySlug: query.categorySlug ?? null,
          deliveryMode: query.deliveryMode ?? null,
          isActive: typeof query.isActive === 'boolean' ? query.isActive : null,
        },
      },
    };
  }

  async createCategory(dto: CreateServiceCategoryDto) {
    const normalizedSlug = this.normalizeSlug(dto.slug);
    const existing = await this.prisma.serviceCategoryModel.findFirst({
      where: { slug: normalizedSlug, tenantId: null },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('A category with that slug already exists.');
    }

    const category = await this.prisma.serviceCategoryModel.create({
      data: {
        name: dto.name.trim(),
        slug: normalizedSlug,
        tenantId: null,
        description: dto.description?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        isActive: true,
        sortOrder: true,
        _count: { select: { services: true } },
      },
    });

    return {
      message: 'Category created successfully.',
      data: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        isActive: category.isActive,
        sortOrder: category.sortOrder,
        serviceCount: category._count.services,
      },
    };
  }

  async updateCategory(id: string, dto: UpdateServiceCategoryDto) {
    await this.ensureCategoryExists(id);

    if (dto.slug) {
      const existing = await this.prisma.serviceCategoryModel.findFirst({
        where: { slug: this.normalizeSlug(dto.slug), tenantId: null },
        select: { id: true },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          'Another category is already using that slug.',
        );
      }
    }

    const category = await this.prisma.serviceCategoryModel.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.slug ? { slug: this.normalizeSlug(dto.slug) } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        isActive: true,
        sortOrder: true,
        _count: { select: { services: true } },
      },
    });

    return {
      message: 'Category updated successfully.',
      data: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        isActive: category.isActive,
        sortOrder: category.sortOrder,
        serviceCount: category._count.services,
      },
    };
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.serviceCategoryModel.findFirst({
      where: { id, tenantId: null },
      select: {
        id: true,
        name: true,
      },
    });

    if (!category) {
      throw new NotFoundException('Service category not found.');
    }

    const linkedServices = await this.prisma.service.count({
      where: { categoryId: id, tenantId: null },
    });

    if (linkedServices > 0) {
      throw new BadRequestException(
        'Delete or move the services in this category before removing it.',
      );
    }

    await this.prisma.serviceCategoryModel.delete({
      where: { id: category.id },
    });

    return {
      message: `${category.name} was deleted successfully.`,
      data: { id: category.id },
    };
  }

  async createService(dto: CreateServiceDto) {
    await this.ensureCategoryExists(dto.categoryId);
    await this.ensureUniqueServiceSlug(this.normalizeSlug(dto.slug));
    this.validateServiceAmounts(dto);

    const service = await this.prisma.service.create({
      data: {
        categoryId: dto.categoryId,
        tenantId: null,
        name: dto.name.trim(),
        slug: this.normalizeSlug(dto.slug),
        description: dto.description?.trim() || null,
        deliveryMode: dto.deliveryMode,
        fulfillmentType: this.getFulfillmentTypeForDeliveryMode(
          dto.deliveryMode,
        ),
        providerCost: nairaToKobo(dto.providerCostNaira ?? 0),
        platformFee: nairaToKobo(dto.platformFeeNaira),
        totalPrice: nairaToKobo(dto.totalPriceNaira),
        cbtCommission: nairaToKobo(dto.cbtCommissionNaira ?? 0),
        providerKey: dto.providerKey?.trim() || null,
        providerServiceCode: dto.providerServiceCode?.trim() || null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
        requiredFields: this.toRequiredFieldsJson(dto.requiredFields),
        requiredDocuments: this.toRequiredDocumentsJson(dto.requiredDocuments),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        isActive: true,
        deliveryMode: true,
        fulfillmentType: true,
        providerCost: true,
        platformFee: true,
        totalPrice: true,
        cbtCommission: true,
        providerKey: true,
        providerServiceCode: true,
        sortOrder: true,
        requiredFields: true,
        requiredDocuments: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return {
      message: 'Service created successfully.',
      data: this.mapServiceRecord(service),
    };
  }

  async updateService(id: string, dto: UpdateServiceDto) {
    const existingService = await this.prisma.service.findFirst({
      where: { id, tenantId: null },
      select: { id: true, deliveryMode: true },
    });

    if (!existingService) {
      throw new NotFoundException('Service not found.');
    }

    if (dto.categoryId) {
      await this.ensureCategoryExists(dto.categoryId);
    }

    if (dto.slug) {
      await this.ensureUniqueServiceSlug(this.normalizeSlug(dto.slug), id);
    }

    this.validateServiceAmounts({
      ...dto,
      deliveryMode: dto.deliveryMode ?? existingService.deliveryMode,
    });

    const service = await this.prisma.service.update({
      where: { id },
      data: {
        ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.slug ? { slug: this.normalizeSlug(dto.slug) } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.deliveryMode
          ? {
              deliveryMode: dto.deliveryMode,
              fulfillmentType: this.getFulfillmentTypeForDeliveryMode(
                dto.deliveryMode,
              ),
            }
          : {}),
        ...(dto.providerCostNaira !== undefined
          ? { providerCost: nairaToKobo(dto.providerCostNaira) }
          : {}),
        ...(dto.platformFeeNaira !== undefined
          ? { platformFee: nairaToKobo(dto.platformFeeNaira) }
          : {}),
        ...(dto.totalPriceNaira !== undefined
          ? { totalPrice: nairaToKobo(dto.totalPriceNaira) }
          : {}),
        ...(dto.cbtCommissionNaira !== undefined
          ? { cbtCommission: nairaToKobo(dto.cbtCommissionNaira) }
          : {}),
        ...(dto.providerKey !== undefined
          ? { providerKey: dto.providerKey?.trim() || null }
          : {}),
        ...(dto.providerServiceCode !== undefined
          ? { providerServiceCode: dto.providerServiceCode?.trim() || null }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.requiredFields !== undefined
          ? { requiredFields: this.toRequiredFieldsJson(dto.requiredFields) }
          : {}),
        ...(dto.requiredDocuments !== undefined
          ? {
              requiredDocuments: this.toRequiredDocumentsJson(
                dto.requiredDocuments,
              ),
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        isActive: true,
        deliveryMode: true,
        fulfillmentType: true,
        providerCost: true,
        platformFee: true,
        totalPrice: true,
        cbtCommission: true,
        providerKey: true,
        providerServiceCode: true,
        sortOrder: true,
        requiredFields: true,
        requiredDocuments: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return {
      message: 'Service updated successfully.',
      data: this.mapServiceRecord(service),
    };
  }

  async deleteService(id: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, tenantId: null },
      select: {
        id: true,
        name: true,
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found.');
    }

    const linkedOrders = await this.prisma.order.count({
      where: { serviceId: service.id },
    });

    if (linkedOrders > 0) {
      throw new BadRequestException(
        'This service already has order history. Deactivate it instead of deleting it.',
      );
    }

    await this.prisma.service.delete({
      where: { id: service.id },
    });

    return {
      message: `${service.name} was deleted successfully.`,
      data: { id: service.id },
    };
  }

  async getCatalog(query: GetServiceCatalogQueryDto, tenantId: string | null) {
    const trimmedSearch = query.search?.trim();
    const tenantFilter = this.buildServiceVisibilityFilter(tenantId);
    const where: Prisma.ServiceWhereInput = {
      isActive: true,
      ...tenantFilter,
      ...(query.categorySlug ? { category: { slug: query.categorySlug } } : {}),
      ...(trimmedSearch
        ? {
            OR: [
              {
                name: {
                  contains: trimmedSearch,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                description: {
                  contains: trimmedSearch,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                category: {
                  name: {
                    contains: trimmedSearch,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
            ],
          }
        : {}),
    };

    const categoryTenantFilter = this.buildCategoryVisibilityFilter(tenantId);
    const [selectionState, categories, services] = await Promise.all([
      tenantId ? this.getTenantServiceSelectionState(tenantId) : null,
      this.prisma.serviceCategoryModel.findMany({
        where: { isActive: true, ...categoryTenantFilter },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          tenantId: true,
          name: true,
          slug: true,
          description: true,
        },
      }),
      this.prisma.service.findMany({
        where,
        orderBy: [
          { category: { sortOrder: 'asc' } },
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
        select: {
          id: true,
          tenantId: true,
          name: true,
          slug: true,
          description: true,
          deliveryMode: true,
          fulfillmentType: true,
          totalPrice: true,
          cbtCommission: true,
          requiredFields: true,
          requiredDocuments: true,
          category: {
            select: {
              id: true,
              tenantId: true,
              name: true,
              slug: true,
              description: true,
            },
          },
        },
      }),
    ]);

    const visibleServices = this.dedupeTenantScopedBySlug(services, tenantId);
    const hasActiveCustomSelection =
      tenantId &&
      selectionState?.usesCustomSelection &&
      selectionState.selectedServiceSlugs.size > 0;
    const selectedVisibleServices = hasActiveCustomSelection
      ? visibleServices.filter((service) =>
          selectionState.selectedServiceSlugs.has(service.slug),
        )
      : visibleServices;
    const visibleCategories = this.buildCatalogCategories(
      categories,
      selectedVisibleServices,
      tenantId,
    );

    return {
      message: 'Service catalog retrieved',
      data: {
        categories: visibleCategories.map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          serviceCount: category.serviceCount,
        })),
        services: selectedVisibleServices.map((service) => ({
          id: service.id,
          name: service.name,
          slug: service.slug,
          description: service.description,
          deliveryMode: service.deliveryMode,
          fulfillmentType: service.fulfillmentType,
          totalPrice: service.totalPrice.toString(),
          cbtCommission: service.cbtCommission.toString(),
          requiredFieldsCount: Array.isArray(service.requiredFields)
            ? service.requiredFields.length
            : 0,
          requiredFields: Array.isArray(service.requiredFields)
            ? (service.requiredFields as RequiredFieldDefinition[])
            : [],
          requiredDocumentsCount: Array.isArray(service.requiredDocuments)
            ? service.requiredDocuments.length
            : 0,
          requiredDocuments: Array.isArray(service.requiredDocuments)
            ? (service.requiredDocuments as RequiredDocumentDefinition[])
            : [],
          eta: this.getEtaForDeliveryMode(service.deliveryMode),
          category: {
            id: service.category.id,
            name: service.category.name,
            slug: service.category.slug,
            description: service.category.description,
          },
        })),
        filters: {
          search: trimmedSearch ?? null,
          categorySlug: query.categorySlug ?? null,
        },
      },
    };
  }

  async getVtuDataPlans(serviceId: string, tenantId: string | null) {
    const service = await this.getAutomatedVtuService(
      serviceId,
      'vtu-data',
      tenantId,
    );
    const cacheKey = `vtu:data-plans:${this.getTenantCacheScope(tenantId)}:${this.vtuService.providerName}:${service.providerKey}`;
    const cached = await this.getCachedValue<{
      plans: {
        code: string;
        name: string;
        amountKobo: string;
        validity: string;
      }[];
    }>(cacheKey);

    if (cached) {
      const integration = await this.getVtuProviderMeta(true, tenantId);
      return {
        message: 'VTU data plans retrieved',
        data: {
          serviceId: service.id,
          serviceName: service.name,
          network: service.providerKey,
          plans: cached.plans,
          provider: integration,
        },
      };
    }

    const plans = await this.runVtuOperation(() =>
      this.vtuService.getDataPlans(service.providerKey, tenantId),
    );
    const mappedPlans = plans.map((plan) => ({
      code: plan.code,
      name: plan.name,
      amountKobo: plan.amountKobo.toString(),
      validity: plan.validity,
    }));

    await this.setCachedValue(
      cacheKey,
      { plans: mappedPlans },
      ServicesService.VTU_PLAN_CACHE_TTL_SECONDS,
    );

    const integration = await this.getVtuProviderMeta(false, tenantId);

    return {
      message: 'VTU data plans retrieved',
      data: {
        serviceId: service.id,
        serviceName: service.name,
        network: service.providerKey,
        plans: mappedPlans,
        provider: integration,
      },
    };
  }

  async getVtuCablePlans(serviceId: string, tenantId: string | null) {
    const service = await this.getAutomatedVtuService(
      serviceId,
      'vtu-cable',
      tenantId,
    );
    const cacheKey = `vtu:cable-plans:${this.getTenantCacheScope(tenantId)}:${this.vtuService.providerName}:${service.providerKey}`;
    const cached = await this.getCachedValue<{
      plans: {
        code: string;
        name: string;
        amountKobo: string;
        duration: string;
      }[];
    }>(cacheKey);

    if (cached) {
      const integration = await this.getVtuProviderMeta(true, tenantId);
      return {
        message: 'VTU cable plans retrieved',
        data: {
          serviceId: service.id,
          serviceName: service.name,
          provider: service.providerKey,
          plans: cached.plans,
          integration,
        },
      };
    }

    const plans = await this.runVtuOperation(() =>
      this.vtuService.getCablePlans(service.providerKey, tenantId),
    );
    const mappedPlans = plans.map((plan) => ({
      code: plan.code,
      name: plan.name,
      amountKobo: plan.amountKobo.toString(),
      duration: plan.duration,
    }));

    await this.setCachedValue(
      cacheKey,
      { plans: mappedPlans },
      ServicesService.VTU_PLAN_CACHE_TTL_SECONDS,
    );

    const integration = await this.getVtuProviderMeta(false, tenantId);

    return {
      message: 'VTU cable plans retrieved',
      data: {
        serviceId: service.id,
        serviceName: service.name,
        provider: service.providerKey,
        plans: mappedPlans,
        integration,
      },
    };
  }

  async verifyVtuCable(
    serviceId: string,
    smartcardNumber: string,
    tenantId: string | null,
  ) {
    const service = await this.getAutomatedVtuService(
      serviceId,
      'vtu-cable',
      tenantId,
    );
    const normalizedSmartcardNumber = smartcardNumber.trim();

    if (normalizedSmartcardNumber.length < 6) {
      throw new BadRequestException(
        'Please enter a valid smartcard or IUC number.',
      );
    }

    const cacheKey = `vtu:cable-verify:${this.getTenantCacheScope(tenantId)}:${this.vtuService.providerName}:${service.providerKey}:${normalizedSmartcardNumber}`;
    const cached =
      await this.getCachedValue<CableVerificationResponseData>(cacheKey);

    if (cached) {
      const integration = await this.getVtuProviderMeta(true, tenantId);
      return {
        message: 'Cable smartcard verified',
        data: {
          ...cached,
          integration,
        },
      };
    }

    const verification = await this.runVtuOperation(() =>
      this.vtuService.verifyCableSmartcard({
        provider: service.providerKey,
        smartcardNumber: normalizedSmartcardNumber,
        tenantId,
      }),
    );

    if (!verification.success || verification.status !== 'VALID') {
      throw new BadRequestException(
        'We could not verify this smartcard number right now.',
      );
    }

    const responseData = {
      ...verification,
      integration: await this.getVtuProviderMeta(false, tenantId),
    };

    await this.setCachedValue(
      cacheKey,
      responseData,
      ServicesService.VTU_VERIFICATION_CACHE_TTL_SECONDS,
    );

    return {
      message: 'Cable smartcard verified',
      data: responseData,
    };
  }

  async verifyVtuElectricity(
    serviceId: string,
    input: { meterNumber: string; meterType: string },
    tenantId: string | null,
  ) {
    const service = await this.getAutomatedVtuService(
      serviceId,
      'vtu-electricity',
      tenantId,
    );
    const meterNumber = input.meterNumber.trim();
    const meterType = input.meterType.trim().toUpperCase();

    if (meterNumber.length < 6) {
      throw new BadRequestException('Please enter a valid meter number.');
    }

    if (meterType !== 'PREPAID' && meterType !== 'POSTPAID') {
      throw new BadRequestException(
        'Please choose either prepaid or postpaid meter type.',
      );
    }

    const cacheKey = `vtu:electricity-verify:${this.getTenantCacheScope(tenantId)}:${this.vtuService.providerName}:${service.providerKey}:${meterType}:${meterNumber}`;
    const cached =
      await this.getCachedValue<ElectricityVerificationResponseData>(cacheKey);

    if (cached) {
      const integration = await this.getVtuProviderMeta(true, tenantId);
      return {
        message: 'Electricity meter verified',
        data: {
          ...cached,
          integration,
        },
      };
    }

    const verification = await this.runVtuOperation(() =>
      this.vtuService.verifyElectricityMeter({
        disco: service.providerKey,
        meterNumber,
        meterType,
        tenantId,
      }),
    );

    if (!verification.success || verification.status !== 'VALID') {
      throw new BadRequestException(
        'We could not verify this meter number right now.',
      );
    }

    const responseData = {
      ...verification,
      integration: await this.getVtuProviderMeta(false, tenantId),
    };

    await this.setCachedValue(
      cacheKey,
      responseData,
      ServicesService.VTU_VERIFICATION_CACHE_TTL_SECONDS,
    );

    return {
      message: 'Electricity meter verified',
      data: responseData,
    };
  }

  private async getVtuProviderMeta(cached: boolean, tenantId?: string | null) {
    const readiness = await this.vtuService.getReadiness({ tenantId });

    return {
      name: readiness.providerName,
      mode: readiness.mode,
      cached,
    };
  }

  private async getCachedValue<T>(key: string): Promise<T | null> {
    try {
      return await this.redisService.getJson<T>(key);
    } catch {
      return null;
    }
  }

  private async setCachedValue(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.redisService.setJson(key, value, ttlSeconds);
    } catch {
      // Intentionally allow VTU reads to continue even if cache writes fail.
    }
  }

  private async runVtuOperation<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch {
      throw new ServiceUnavailableException(
        'This provider service is temporarily unavailable. Please try again shortly.',
      );
    }
  }

  private async getAutomatedVtuService(
    serviceId: string,
    categorySlug: 'vtu-data' | 'vtu-cable' | 'vtu-electricity',
    tenantId: string | null,
  ) {
    const service = await this.prisma.service.findFirst({
      where: {
        id: serviceId,
        ...this.buildServiceVisibilityFilter(tenantId),
      },
      select: {
        id: true,
        name: true,
        providerKey: true,
        deliveryMode: true,
        category: {
          select: {
            slug: true,
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found.');
    }

    if (
      service.deliveryMode !== ServiceDeliveryMode.API_AUTOMATED ||
      service.category.slug !== categorySlug ||
      !service.providerKey
    ) {
      throw new BadRequestException(
        'This service is not available for this automated VTU action.',
      );
    }

    return {
      ...service,
      providerKey: service.providerKey,
    };
  }

  private mapServiceRecord(service: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    isActive: boolean;
    deliveryMode: ServiceDeliveryMode;
    fulfillmentType: FulfillmentType;
    providerCost: bigint;
    platformFee: bigint;
    totalPrice: bigint;
    cbtCommission: bigint;
    providerKey: string | null;
    providerServiceCode: string | null;
    sortOrder: number;
    requiredFields: Prisma.JsonValue;
    requiredDocuments: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
    category: {
      id: string;
      name: string;
      slug: string;
    };
  }) {
    return {
      id: service.id,
      name: service.name,
      slug: service.slug,
      description: service.description,
      isActive: service.isActive,
      deliveryMode: service.deliveryMode,
      fulfillmentType: service.fulfillmentType,
      providerCost: service.providerCost.toString(),
      platformFee: service.platformFee.toString(),
      totalPrice: service.totalPrice.toString(),
      cbtCommission: service.cbtCommission.toString(),
      providerKey: service.providerKey,
      providerServiceCode: service.providerServiceCode,
      sortOrder: service.sortOrder,
      requiredFields: Array.isArray(service.requiredFields)
        ? service.requiredFields
        : [],
      requiredDocuments: Array.isArray(service.requiredDocuments)
        ? service.requiredDocuments
        : [],
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
      category: service.category,
    };
  }

  private normalizeSlug(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async ensureCategoryExists(id: string) {
    const category = await this.prisma.serviceCategoryModel.findFirst({
      where: { id, tenantId: null },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Service category not found.');
    }
  }

  private async ensureServiceExists(id: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, tenantId: null },
      select: { id: true },
    });

    if (!service) {
      throw new NotFoundException('Service not found.');
    }
  }

  private async ensureUniqueServiceSlug(slug: string, currentId?: string) {
    const service = await this.prisma.service.findFirst({
      where: { slug, tenantId: null },
      select: { id: true },
    });

    if (service && service.id !== currentId) {
      throw new ConflictException('A service with that slug already exists.');
    }
  }

  private buildServiceVisibilityFilter(tenantId: string | null) {
    return tenantId
      ? ({
          OR: [{ tenantId: null }, { tenantId }],
        } satisfies Prisma.ServiceWhereInput)
      : ({ tenantId: null } satisfies Prisma.ServiceWhereInput);
  }

  private buildCategoryVisibilityFilter(tenantId: string | null) {
    return tenantId
      ? ({
          OR: [{ tenantId: null }, { tenantId }],
        } satisfies Prisma.ServiceCategoryModelWhereInput)
      : ({ tenantId: null } satisfies Prisma.ServiceCategoryModelWhereInput);
  }

  private getTenantCacheScope(tenantId: string | null) {
    return tenantId ?? 'platform';
  }

  private async getTenantServiceSelectionState(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        usesCustomServiceSelection: true,
        serviceSelections: {
          select: {
            serviceSlug: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    return {
      usesCustomSelection: tenant.usesCustomServiceSelection,
      selectedServiceSlugs: new Set(
        tenant.serviceSelections.map((selection) => selection.serviceSlug),
      ),
    };
  }

  private dedupeTenantScopedBySlug<
    T extends { slug: string; tenantId: string | null },
  >(records: T[], tenantId: string | null) {
    const deduped = new Map<string, T>();

    for (const record of records) {
      const existing = deduped.get(record.slug);

      if (!existing) {
        deduped.set(record.slug, record);
        continue;
      }

      if (
        tenantId &&
        existing.tenantId !== tenantId &&
        record.tenantId === tenantId
      ) {
        deduped.set(record.slug, record);
      }
    }

    return Array.from(deduped.values());
  }

  private buildCatalogCategories(
    categories: Array<{
      id: string;
      tenantId: string | null;
      name: string;
      slug: string;
      description: string | null;
    }>,
    services: Array<{
      category: {
        id: string;
        tenantId: string | null;
        name: string;
        slug: string;
        description: string | null;
      };
    }>,
    tenantId: string | null,
  ) {
    const counts = services.reduce<Map<string, number>>((map, service) => {
      map.set(service.category.slug, (map.get(service.category.slug) ?? 0) + 1);
      return map;
    }, new Map());

    const serviceCategories = services.map((service) => service.category);

    return this.dedupeTenantScopedBySlug(
      [...categories, ...serviceCategories],
      tenantId,
    )
      .map((category) => ({
        ...category,
        serviceCount: counts.get(category.slug) ?? 0,
      }))
      .filter((category) => category.serviceCount > 0);
  }

  private validateServiceAmounts(dto: {
    deliveryMode?: ServiceDeliveryMode;
    platformFeeNaira?: number;
    totalPriceNaira?: number;
    cbtCommissionNaira?: number;
    providerCostNaira?: number;
  }) {
    const values = [
      dto.platformFeeNaira,
      dto.totalPriceNaira,
      dto.cbtCommissionNaira,
      dto.providerCostNaira,
    ].filter((value): value is number => value !== undefined);

    if (values.some((value) => Number.isNaN(value) || value < 0)) {
      throw new BadRequestException(
        'Service pricing values must be valid non-negative numbers.',
      );
    }

    if (
      dto.totalPriceNaira !== undefined &&
      dto.platformFeeNaira !== undefined &&
      dto.totalPriceNaira < dto.platformFeeNaira
    ) {
      throw new BadRequestException(
        'Total price cannot be lower than the platform fee.',
      );
    }

    if (
      dto.deliveryMode &&
      dto.deliveryMode !== ServiceDeliveryMode.CBT_MANUAL &&
      (dto.cbtCommissionNaira ?? 0) > 0
    ) {
      throw new BadRequestException(
        'Only CBT-managed services can carry a CBT commission.',
      );
    }
  }

  private getFulfillmentTypeForDeliveryMode(
    deliveryMode: ServiceDeliveryMode,
  ): FulfillmentType {
    return deliveryMode === ServiceDeliveryMode.CBT_MANUAL
      ? FulfillmentType.MANUAL
      : FulfillmentType.AUTOMATED;
  }

  private getEtaForDeliveryMode(deliveryMode: ServiceDeliveryMode) {
    switch (deliveryMode) {
      case ServiceDeliveryMode.API_AUTOMATED:
        return 'Delivered by the connected provider once payment is confirmed';
      case ServiceDeliveryMode.PIN_STOCK:
        return 'Delivered instantly from stocked PIN inventory after payment';
      case ServiceDeliveryMode.CBT_MANUAL:
      default:
        return 'Handled by approved operators after submission';
    }
  }

  private toRequiredFieldsJson(
    value: Record<string, unknown>[] | undefined,
  ): Prisma.InputJsonValue {
    return this.normalizeRequiredFields(value) as Prisma.InputJsonValue;
  }

  private toRequiredDocumentsJson(
    value: Record<string, unknown>[] | undefined,
  ): Prisma.InputJsonValue {
    return this.normalizeRequiredDocuments(value) as Prisma.InputJsonValue;
  }

  private normalizeRequiredFields(
    value: Record<string, unknown>[] | undefined,
  ): RequiredFieldDefinition[] {
    const seenNames = new Set<string>();

    return (value ?? []).map((item, index) => {
      const raw = this.toObjectRecord(item, 'required field', index);
      const name = this.normalizeRequiredFieldName(raw.name);

      if (!name) {
        throw new BadRequestException(
          `Required field ${index + 1} must include a field key.`,
        );
      }

      if (seenNames.has(name)) {
        throw new BadRequestException(
          `Required field keys must be unique. Duplicate key: ${name}.`,
        );
      }

      seenNames.add(name);

      const label = this.normalizeOptionalString(raw.label);
      const placeholder = this.normalizeOptionalString(raw.placeholder);
      const helpText = this.normalizeOptionalString(raw.helpText);
      const type = this.normalizeRequiredFieldType(raw.type);
      const options = this.normalizeStringArray(raw.options);

      if (type === 'select' && options.length === 0) {
        throw new BadRequestException(
          `Required field ${name} must include at least one option.`,
        );
      }

      return {
        name,
        ...(label ? { label } : {}),
        ...(type !== 'text' ? { type } : {}),
        ...(raw.required === true ? { required: true } : {}),
        ...(placeholder ? { placeholder } : {}),
        ...(helpText ? { helpText } : {}),
        ...(options.length > 0 ? { options } : {}),
      };
    });
  }

  private normalizeRequiredDocuments(
    value: Record<string, unknown>[] | undefined,
  ): RequiredDocumentDefinition[] {
    const seenNames = new Set<string>();

    return (value ?? []).map((item, index) => {
      const raw = this.toObjectRecord(item, 'required document', index);
      const name = this.normalizeRequiredFieldName(raw.name);

      if (!name) {
        throw new BadRequestException(
          `Required document ${index + 1} must include a document key.`,
        );
      }

      if (seenNames.has(name)) {
        throw new BadRequestException(
          `Required document keys must be unique. Duplicate key: ${name}.`,
        );
      }

      seenNames.add(name);

      const label = this.normalizeOptionalString(raw.label);
      const description = this.normalizeOptionalString(raw.description);
      const acceptedTypes = this.normalizeStringArray(raw.acceptedTypes);

      return {
        name,
        ...(label ? { label } : {}),
        ...(raw.required === false ? { required: false } : {}),
        ...(acceptedTypes.length > 0 ? { acceptedTypes } : {}),
        ...(description ? { description } : {}),
      };
    });
  }

  private toObjectRecord(
    value: unknown,
    label: string,
    index: number,
  ): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException(
        `Each ${label} entry must be an object. Problem at item ${index + 1}.`,
      );
    }

    return value as Record<string, unknown>;
  }

  private normalizeRequiredFieldName(value: unknown) {
    if (typeof value !== 'string') {
      return '';
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return '';
    }

    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(trimmed)) {
      throw new BadRequestException(
        'Field keys must start with a letter and contain only letters, numbers, or underscores.',
      );
    }

    return trimmed;
  }

  private normalizeRequiredFieldType(value: unknown): RequiredFieldType {
    if (typeof value !== 'string') {
      return 'text';
    }

    return (REQUIRED_FIELD_TYPES as readonly string[]).includes(value)
      ? (value as RequiredFieldType)
      : 'text';
  }

  private normalizeStringArray(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    const seen = new Set<string>();

    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => {
        if (!item || seen.has(item)) {
          return false;
        }

        seen.add(item);
        return true;
      });
  }

  private normalizeOptionalString(value: unknown) {
    return typeof value === 'string' ? value.trim() || null : null;
  }

  private normalizeNullableString(value: string | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private normalizePath(value: string | undefined) {
    const trimmed = value?.trim();

    if (!trimmed) {
      return null;
    }

    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
}
