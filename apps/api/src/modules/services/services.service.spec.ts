import { NotFoundException } from '@nestjs/common';
import { FulfillmentType, ServiceDeliveryMode } from '@prisma/client';
import { ServicesService } from './services.service';

describe('ServicesService', () => {
  let prisma: {
    tenant: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    tenantServiceSelection: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    serviceCategoryModel: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      delete: jest.Mock;
    };
    service: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    order: {
      count: jest.Mock;
    };
    platformProviderConfig: {
      findUnique: jest.Mock;
    };
    providerValidationEvent: {
      findMany: jest.Mock;
    };
  };
  let vtuService: {
    providerName: string;
    getReadiness: jest.Mock;
    getDataPlans: jest.Mock;
    getCablePlans: jest.Mock;
    verifyCableSmartcard: jest.Mock;
    verifyElectricityMeter: jest.Mock;
  };
  let redisService: {
    getJson: jest.Mock;
    setJson: jest.Mock;
  };
  let providerCredentialsService: {
    encrypt: jest.Mock;
    decrypt: jest.Mock;
    mask: jest.Mock;
  };
  let service: ServicesService;

  beforeEach(() => {
    prisma = {
      tenant: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      tenantServiceSelection: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      serviceCategoryModel: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      service: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      order: {
        count: jest.fn(),
      },
      platformProviderConfig: {
        findUnique: jest.fn(),
      },
      providerValidationEvent: {
        findMany: jest.fn(),
      },
    };

    vtuService = {
      providerName: 'PROVIDER_ONE',
      getReadiness: jest.fn(),
      getDataPlans: jest.fn(),
      getCablePlans: jest.fn(),
      verifyCableSmartcard: jest.fn(),
      verifyElectricityMeter: jest.fn(),
    };

    redisService = {
      getJson: jest.fn(),
      setJson: jest.fn(),
    };

    providerCredentialsService = {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
      mask: jest.fn(),
    };

    service = new ServicesService(
      prisma as never,
      vtuService as never,
      redisService as never,
      providerCredentialsService as never,
    );
  });

  it('prefers tenant-scoped service overrides in the catalog', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      usesCustomServiceSelection: false,
      serviceSelections: [],
    });
    prisma.serviceCategoryModel.findMany.mockResolvedValue([
      {
        id: 'cat-platform',
        tenantId: null,
        name: 'Airtime',
        slug: 'vtu-airtime',
        description: 'Platform airtime',
      },
      {
        id: 'cat-tenant',
        tenantId: 'tenant-1',
        name: 'Airtime',
        slug: 'vtu-airtime',
        description: 'Tenant airtime',
      },
    ]);
    prisma.service.findMany.mockResolvedValue([
      {
        id: 'svc-platform',
        tenantId: null,
        name: '9Mobile Airtime',
        slug: '9mobile-airtime',
        description: 'Platform service',
        deliveryMode: ServiceDeliveryMode.API_AUTOMATED,
        fulfillmentType: FulfillmentType.AUTOMATED,
        totalPrice: 10000n,
        cbtCommission: 0n,
        requiredFields: [],
        requiredDocuments: [],
        category: {
          id: 'cat-platform',
          tenantId: null,
          name: 'Airtime',
          slug: 'vtu-airtime',
          description: 'Platform airtime',
        },
      },
      {
        id: 'svc-tenant',
        tenantId: 'tenant-1',
        name: '9Mobile Airtime',
        slug: '9mobile-airtime',
        description: 'Tenant override',
        deliveryMode: ServiceDeliveryMode.API_AUTOMATED,
        fulfillmentType: FulfillmentType.AUTOMATED,
        totalPrice: 12000n,
        cbtCommission: 0n,
        requiredFields: [],
        requiredDocuments: [],
        category: {
          id: 'cat-tenant',
          tenantId: 'tenant-1',
          name: 'Airtime',
          slug: 'vtu-airtime',
          description: 'Tenant airtime',
        },
      },
    ]);

    const result = await service.getCatalog({}, 'tenant-1');

    expect(result.data.services).toHaveLength(1);
    expect(result.data.services[0]).toMatchObject({
      id: 'svc-tenant',
      description: 'Tenant override',
    });
    expect(result.data.categories).toEqual([
      expect.objectContaining({
        id: 'cat-tenant',
        slug: 'vtu-airtime',
        serviceCount: 1,
      }),
    ]);
  });

  it('rejects VTU service access outside the visible tenant scope', async () => {
    prisma.service.findFirst.mockResolvedValue(null);

    await expect(
      service.getVtuDataPlans('foreign-service', 'tenant-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes a platform service without order history', async () => {
    prisma.service.findFirst.mockResolvedValue({
      id: 'svc-1',
      name: 'NIN Validation',
    });
    prisma.order.count.mockResolvedValue(0);
    prisma.service.delete.mockResolvedValue({ id: 'svc-1' });

    const result = await service.deleteService('svc-1');

    expect(prisma.service.delete).toHaveBeenCalledWith({
      where: { id: 'svc-1' },
    });
    expect(result.message).toContain('deleted successfully');
  });

  it('prevents deleting a category that still has services', async () => {
    prisma.serviceCategoryModel.findFirst.mockResolvedValue({
      id: 'cat-1',
      name: 'Identity Services',
    });
    prisma.service.count.mockResolvedValue(2);

    await expect(service.deleteCategory('cat-1')).rejects.toThrow(
      'Delete or move the services in this category before removing it.',
    );
  });
});
