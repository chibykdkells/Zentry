import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FulfillmentType, Prisma, ServiceDeliveryMode } from '@prisma/client';
import { nairaToKobo } from '@zentry/utils';
import { GetServiceCatalogQueryDto } from './dto/get-service-catalog.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { GetAdminServicesQueryDto } from './dto/get-admin-services.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

type RequiredFieldDefinition = {
  name: string;
  label?: string;
  type?: string;
  required?: boolean;
};

type RequiredDocumentDefinition = {
  name: string;
  label?: string;
  required?: boolean;
  acceptedTypes?: string[];
  description?: string;
};

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminCategories() {
    const categories = await this.prisma.serviceCategoryModel.findMany({
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

  async getAdminServices(query: GetAdminServicesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const search = query.search?.trim();

    const where: Prisma.ServiceWhereInput = {
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
      this.prisma.service.count(),
      this.prisma.service.count({ where: { isActive: true } }),
      this.prisma.service.count({
        where: { fulfillmentType: FulfillmentType.MANUAL },
      }),
      this.prisma.service.count({
        where: { fulfillmentType: FulfillmentType.AUTOMATED },
      }),
      this.prisma.service.count({
        where: { deliveryMode: ServiceDeliveryMode.API_AUTOMATED },
      }),
      this.prisma.service.count({
        where: { deliveryMode: ServiceDeliveryMode.PIN_STOCK },
      }),
      this.prisma.serviceCategoryModel.findMany({
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
    const existing = await this.prisma.serviceCategoryModel.findUnique({
      where: { slug: normalizedSlug },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('A category with that slug already exists.');
    }

    const category = await this.prisma.serviceCategoryModel.create({
      data: {
        name: dto.name.trim(),
        slug: normalizedSlug,
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
      const existing = await this.prisma.serviceCategoryModel.findUnique({
        where: { slug: this.normalizeSlug(dto.slug) },
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

  async createService(dto: CreateServiceDto) {
    await this.ensureCategoryExists(dto.categoryId);
    await this.ensureUniqueServiceSlug(this.normalizeSlug(dto.slug));
    this.validateServiceAmounts(dto);

    const service = await this.prisma.service.create({
      data: {
        categoryId: dto.categoryId,
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
        requiredFields: this.toInputJsonArray(dto.requiredFields),
        requiredDocuments: this.toInputJsonArray(dto.requiredDocuments),
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
    const existingService = await this.prisma.service.findUnique({
      where: { id },
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
          ? { requiredFields: this.toInputJsonArray(dto.requiredFields) }
          : {}),
        ...(dto.requiredDocuments !== undefined
          ? { requiredDocuments: this.toInputJsonArray(dto.requiredDocuments) }
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

  async getCatalog(query: GetServiceCatalogQueryDto) {
    const trimmedSearch = query.search?.trim();
    const where: Prisma.ServiceWhereInput = {
      isActive: true,
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

    const [categories, services] = await this.prisma.$transaction([
      this.prisma.serviceCategoryModel.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          services: {
            where: { isActive: true },
            select: { id: true },
          },
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
              name: true,
              slug: true,
              description: true,
            },
          },
        },
      }),
    ]);

    return {
      message: 'Service catalog retrieved',
      data: {
        categories: categories.map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          serviceCount: category.services.length,
        })),
        services: services.map((service) => ({
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
    const category = await this.prisma.serviceCategoryModel.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Service category not found.');
    }
  }

  private async ensureServiceExists(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!service) {
      throw new NotFoundException('Service not found.');
    }
  }

  private async ensureUniqueServiceSlug(slug: string, currentId?: string) {
    const service = await this.prisma.service.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (service && service.id !== currentId) {
      throw new ConflictException('A service with that slug already exists.');
    }
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

  private toInputJsonArray(
    value: Record<string, unknown>[] | undefined,
  ): Prisma.InputJsonValue {
    return (value ?? []) as Prisma.InputJsonValue;
  }
}
