import { ProviderRolloutMode } from '@prisma/client';
import { ProviderOneVtuProvider } from './provider-one.provider';

describe('ProviderOneVtuProvider', () => {
  let prisma: {
    platformProviderConfig: {
      findUnique: jest.Mock;
    };
  };
  let config: {
    get: jest.Mock;
  };
  let credentials: {
    decrypt: jest.Mock;
  };
  let provider: ProviderOneVtuProvider;

  beforeEach(() => {
    prisma = {
      platformProviderConfig: {
        findUnique: jest.fn(),
      },
    };

    config = {
      get: jest.fn((_key: string, fallback?: string) => fallback ?? ''),
    };

    credentials = {
      decrypt: jest.fn((value: string) => value),
    };

    provider = new ProviderOneVtuProvider(
      config as never,
      prisma as never,
      credentials as never,
    );
  });

  it('prefers tenant-scoped VTU config when present', async () => {
    prisma.platformProviderConfig.findUnique.mockResolvedValueOnce({
      rolloutMode: ProviderRolloutMode.MOCK,
      isEnabled: true,
      baseUrl: 'https://tenant.example.com',
      apiKeyEncrypted: 'tenant-secret',
      apiKeyHeader: 'Authorization',
      apiKeyPrefix: 'Bearer ',
      healthPath: '/health',
      airtimePath: '/airtime',
      dataPurchasePath: '/data/purchase',
      dataPlansPath: '/data/plans',
      cablePlansPath: '/cable/plans',
      cableVerifyPath: '/cable/verify',
      cablePurchasePath: '/cable/purchase',
      electricityVerifyPath: '/electricity/verify',
      electricityPurchasePath: '/electricity/purchase',
    });

    const readiness = await provider.getReadiness({ tenantId: 'tenant-1' });

    expect(prisma.platformProviderConfig.findUnique).toHaveBeenNthCalledWith(
      1,
      {
        where: {
          providerType_providerKey_scopeType_scopeKey: {
            providerType: 'VTU',
            providerKey: 'PROVIDER_ONE',
            scopeType: 'TENANT',
            scopeKey: 'tenant-1',
          },
        },
      },
    );
    expect(readiness.resolvedScope).toEqual({
      type: 'TENANT',
      key: 'tenant-1',
    });
    expect(readiness.mode).toBe('mock');
  });

  it('falls back to the platform VTU config when no tenant override exists', async () => {
    prisma.platformProviderConfig.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        rolloutMode: ProviderRolloutMode.MOCK,
        isEnabled: true,
        baseUrl: 'https://platform.example.com',
        apiKeyEncrypted: 'platform-secret',
        apiKeyHeader: 'Authorization',
        apiKeyPrefix: 'Bearer ',
        healthPath: '/health',
        airtimePath: '/airtime',
        dataPurchasePath: '/data/purchase',
        dataPlansPath: '/data/plans',
        cablePlansPath: '/cable/plans',
        cableVerifyPath: '/cable/verify',
        cablePurchasePath: '/cable/purchase',
        electricityVerifyPath: '/electricity/verify',
        electricityPurchasePath: '/electricity/purchase',
      });

    const readiness = await provider.getReadiness({ tenantId: 'tenant-2' });

    expect(prisma.platformProviderConfig.findUnique).toHaveBeenNthCalledWith(
      2,
      {
        where: {
          providerType_providerKey_scopeType_scopeKey: {
            providerType: 'VTU',
            providerKey: 'PROVIDER_ONE',
            scopeType: 'PLATFORM',
            scopeKey: 'platform',
          },
        },
      },
    );
    expect(readiness.resolvedScope).toEqual({
      type: 'PLATFORM',
      key: 'platform',
    });
    expect(readiness.mode).toBe('mock');
  });
});
