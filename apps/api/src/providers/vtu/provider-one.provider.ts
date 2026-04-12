import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderRolloutMode } from '@prisma/client';
import {
  AirtimePurchaseInput,
  CablePlan,
  CablePurchaseInput,
  DataPurchaseInput,
  ElectricityPurchaseInput,
  IVtuProvider,
  VtuDataPlan,
  VtuProviderReadiness,
  VerifyCableSmartcardInput,
  VerifyCableSmartcardResult,
  VerifyElectricityMeterInput,
  VerifyElectricityMeterResult,
  VtuPurchaseResult,
} from '../interfaces';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { ProviderCredentialsService } from '../provider-credentials.service';

type ResolvedProviderOneConfig = {
  scopeType: 'PLATFORM' | 'TENANT';
  scopeKey: string;
  mode: 'live' | 'mock';
  rolloutMode: ProviderRolloutMode;
  isEnabled: boolean;
  missingConfig: string[];
  baseUrl: string;
  apiKey: string;
  apiKeyHeader: string;
  apiKeyPrefix: string;
  healthPath: string;
  airtimePath: string;
  dataPurchasePath: string;
  dataPlansPath: string;
  cablePlansPath: string;
  cableVerifyPath: string;
  cablePurchasePath: string;
  electricityVerifyPath: string;
  electricityPurchasePath: string;
};

@Injectable()
export class ProviderOneVtuProvider implements IVtuProvider {
  readonly providerName = 'PROVIDER_ONE';
  private readonly logger = new Logger(ProviderOneVtuProvider.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiKeyHeader: string;
  private readonly apiKeyPrefix: string;
  private readonly healthPath: string;
  private readonly airtimePath: string;
  private readonly dataPurchasePath: string;
  private readonly dataPlansPath: string;
  private readonly cablePlansPath: string;
  private readonly cableVerifyPath: string;
  private readonly cablePurchasePath: string;
  private readonly electricityVerifyPath: string;
  private readonly electricityPurchasePath: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly providerCredentialsService: ProviderCredentialsService,
  ) {
    this.baseUrl = config.get<string>('VTU_PROVIDER_ONE_BASE_URL', '');
    this.apiKey = config.get<string>('VTU_PROVIDER_ONE_API_KEY', '');
    this.apiKeyHeader = config.get<string>(
      'VTU_PROVIDER_ONE_API_KEY_HEADER',
      'Authorization',
    );
    this.apiKeyPrefix = config.get<string>(
      'VTU_PROVIDER_ONE_API_KEY_PREFIX',
      'Bearer ',
    );
    this.healthPath = config.get<string>(
      'VTU_PROVIDER_ONE_HEALTH_PATH',
      '/health',
    );
    this.airtimePath = config.get<string>(
      'VTU_PROVIDER_ONE_AIRTIME_PATH',
      '/airtime/purchase',
    );
    this.dataPurchasePath = config.get<string>(
      'VTU_PROVIDER_ONE_DATA_PURCHASE_PATH',
      '/data/purchase',
    );
    this.dataPlansPath = config.get<string>(
      'VTU_PROVIDER_ONE_DATA_PLANS_PATH',
      '/data/plans',
    );
    this.cablePlansPath = config.get<string>(
      'VTU_PROVIDER_ONE_CABLE_PLANS_PATH',
      '/cable/plans',
    );
    this.cableVerifyPath = config.get<string>(
      'VTU_PROVIDER_ONE_CABLE_VERIFY_PATH',
      '/cable/verify',
    );
    this.cablePurchasePath = config.get<string>(
      'VTU_PROVIDER_ONE_CABLE_PURCHASE_PATH',
      '/cable/purchase',
    );
    this.electricityVerifyPath = config.get<string>(
      'VTU_PROVIDER_ONE_ELECTRICITY_VERIFY_PATH',
      '/electricity/verify',
    );
    this.electricityPurchasePath = config.get<string>(
      'VTU_PROVIDER_ONE_ELECTRICITY_PURCHASE_PATH',
      '/electricity/purchase',
    );
  }

  get providerMode(): 'live' | 'mock' {
    return this.baseUrl && this.apiKey ? 'live' : 'mock';
  }

  async getReadiness(input?: {
    tenantId?: string | null;
  }): Promise<VtuProviderReadiness> {
    const runtimeConfig = await this.loadRuntimeConfig(input?.tenantId);

    const readiness: VtuProviderReadiness = {
      providerName: this.providerName,
      mode: runtimeConfig.mode,
      resolvedScope: {
        type: runtimeConfig.scopeType,
        key: runtimeConfig.scopeKey,
      },
      configured: runtimeConfig.missingConfig.length === 0,
      supportsLiveTransport: true,
      missingConfig: runtimeConfig.missingConfig,
      endpoints: {
        health: runtimeConfig.healthPath || null,
        airtime: runtimeConfig.airtimePath,
        dataPurchase: runtimeConfig.dataPurchasePath,
        dataPlans: runtimeConfig.dataPlansPath,
        cablePlans: runtimeConfig.cablePlansPath,
        cableVerify: runtimeConfig.cableVerifyPath,
        cablePurchase: runtimeConfig.cablePurchasePath,
        electricityVerify: runtimeConfig.electricityVerifyPath,
        electricityPurchase: runtimeConfig.electricityPurchasePath,
      },
      probe: {
        attempted: false,
        status: runtimeConfig.mode === 'mock' ? 'not_applicable' : 'error',
        message:
          runtimeConfig.mode === 'mock'
            ? this.getMockModeMessage(runtimeConfig)
            : 'Live transport is configured but not yet probed.',
        checkedAt: new Date().toISOString(),
      },
    };

    if (runtimeConfig.mode === 'mock' || !runtimeConfig.healthPath) {
      return readiness;
    }

    try {
      readiness.probe.attempted = true;
      await this.requestJson('GET', runtimeConfig.healthPath, runtimeConfig);
      readiness.probe.status = 'healthy';
      readiness.probe.message = 'Provider health probe succeeded.';
    } catch (error) {
      readiness.probe.status =
        error instanceof Error &&
        /HTTP 5\d\d|HTTP 4\d\d|fetch failed/i.test(error.message)
          ? 'unreachable'
          : 'error';
      readiness.probe.message =
        error instanceof Error
          ? error.message
          : 'Provider health probe failed.';
    }

    readiness.probe.checkedAt = new Date().toISOString();
    return readiness;
  }

  async purchaseAirtime(
    input: AirtimePurchaseInput,
  ): Promise<VtuPurchaseResult> {
    const runtimeConfig = await this.loadRuntimeConfig(input.tenantId);

    if (runtimeConfig.mode === 'mock') {
      this.logMockUsage('airtime', input.reference);

      return {
        success: true,
        reference: input.reference,
        providerReference: `vtu-airtime-${input.reference}`,
        status: 'SUCCESS',
      };
    }

    const payload = await this.requestJson(
      'POST',
      runtimeConfig.airtimePath,
      runtimeConfig,
      {
        phone: input.phone,
        network: input.network,
        amountKobo: input.amountKobo.toString(),
        amount: input.amountKobo.toString(),
        reference: input.reference,
      },
    );

    return this.normalizePurchaseResult(payload, input.reference);
  }

  async purchaseData(input: DataPurchaseInput): Promise<VtuPurchaseResult> {
    const runtimeConfig = await this.loadRuntimeConfig(input.tenantId);

    if (runtimeConfig.mode === 'mock') {
      this.logMockUsage('data', input.reference);

      return {
        success: true,
        reference: input.reference,
        providerReference: `vtu-data-${input.reference}`,
        status: 'SUCCESS',
      };
    }

    const payload = await this.requestJson(
      'POST',
      runtimeConfig.dataPurchasePath,
      runtimeConfig,
      {
        phone: input.phone,
        planCode: input.planCode,
        amountKobo: input.amountKobo.toString(),
        amount: input.amountKobo.toString(),
        reference: input.reference,
      },
    );

    return this.normalizePurchaseResult(payload, input.reference);
  }

  async getCablePlans(
    provider: string,
    tenantId?: string | null,
  ): Promise<CablePlan[]> {
    const runtimeConfig = await this.loadRuntimeConfig(tenantId);

    if (runtimeConfig.mode === 'live') {
      const payload = await this.requestJson(
        'GET',
        runtimeConfig.cablePlansPath,
        runtimeConfig,
        undefined,
        { provider },
      );

      return this.extractArray(payload)
        .map((item) => this.normalizeCablePlan(item))
        .filter((item): item is CablePlan => Boolean(item));
    }

    const key = provider.trim().toUpperCase();
    return this.cablePlansByProvider[key] ?? [];
  }

  async verifyCableSmartcard(
    input: VerifyCableSmartcardInput,
  ): Promise<VerifyCableSmartcardResult> {
    const runtimeConfig = await this.loadRuntimeConfig(input.tenantId);

    if (runtimeConfig.mode === 'mock') {
      this.logMockUsage('cable verification', input.smartcardNumber);

      return {
        success: true,
        provider: input.provider,
        smartcardNumber: input.smartcardNumber,
        customerName: `${input.provider} Viewer`,
        currentPlan: 'Compact',
        dueDate: '2026-05-01',
        status: 'VALID',
      };
    }

    const payload = await this.requestJson(
      'POST',
      runtimeConfig.cableVerifyPath,
      runtimeConfig,
      {
        provider: input.provider,
        smartcardNumber: input.smartcardNumber,
      },
    );

    return this.normalizeCableVerification(payload, input);
  }

  async purchaseCable(input: CablePurchaseInput): Promise<VtuPurchaseResult> {
    const runtimeConfig = await this.loadRuntimeConfig(input.tenantId);

    if (runtimeConfig.mode === 'mock') {
      this.logMockUsage('cable', input.reference);

      return {
        success: true,
        reference: input.reference,
        providerReference: `vtu-cable-${input.reference}`,
        status: 'SUCCESS',
      };
    }

    const payload = await this.requestJson(
      'POST',
      runtimeConfig.cablePurchasePath,
      runtimeConfig,
      {
        provider: input.provider,
        smartcardNumber: input.smartcardNumber,
        planCode: input.planCode,
        amountKobo: input.amountKobo.toString(),
        amount: input.amountKobo.toString(),
        reference: input.reference,
      },
    );

    return this.normalizePurchaseResult(payload, input.reference);
  }

  async verifyElectricityMeter(
    input: VerifyElectricityMeterInput,
  ): Promise<VerifyElectricityMeterResult> {
    const runtimeConfig = await this.loadRuntimeConfig(input.tenantId);

    if (runtimeConfig.mode === 'mock') {
      this.logMockUsage('electricity verification', input.meterNumber);

      return {
        success: true,
        disco: input.disco,
        meterNumber: input.meterNumber,
        meterType: input.meterType,
        customerName: `${input.disco} Customer`,
        address: '12 Marina Road, Lagos',
        status: 'VALID',
      };
    }

    const payload = await this.requestJson(
      'POST',
      runtimeConfig.electricityVerifyPath,
      runtimeConfig,
      {
        disco: input.disco,
        meterNumber: input.meterNumber,
        meterType: input.meterType,
      },
    );

    return this.normalizeElectricityVerification(payload, input);
  }

  async purchaseElectricity(
    input: ElectricityPurchaseInput,
  ): Promise<VtuPurchaseResult> {
    const runtimeConfig = await this.loadRuntimeConfig(input.tenantId);

    if (runtimeConfig.mode === 'mock') {
      this.logMockUsage('electricity', input.reference);

      return {
        success: true,
        reference: input.reference,
        providerReference: `vtu-electricity-${input.reference}`,
        status: 'SUCCESS',
        metadata: {
          token: `${input.disco}-${input.meterNumber}-4829-1182-7700`,
          units: Number(input.amountKobo) / 1000,
        },
      };
    }

    const payload = await this.requestJson(
      'POST',
      runtimeConfig.electricityPurchasePath,
      runtimeConfig,
      {
        disco: input.disco,
        meterNumber: input.meterNumber,
        meterType: input.meterType,
        amountKobo: input.amountKobo.toString(),
        amount: input.amountKobo.toString(),
        reference: input.reference,
      },
    );

    return this.normalizePurchaseResult(payload, input.reference, {
      token: this.getString(payload, [
        'token',
        'meterToken',
        'unitsToken',
        'tokenCode',
      ]),
      units: this.getNumber(payload, ['units', 'unitValue', 'purchasedUnits']),
    });
  }

  async getDataPlans(
    network: string,
    tenantId?: string | null,
  ): Promise<VtuDataPlan[]> {
    const runtimeConfig = await this.loadRuntimeConfig(tenantId);

    if (runtimeConfig.mode === 'live') {
      const payload = await this.requestJson(
        'GET',
        runtimeConfig.dataPlansPath,
        runtimeConfig,
        undefined,
        { network },
      );

      return this.extractArray(payload)
        .map((item) => this.normalizeDataPlan(item))
        .filter((item): item is VtuDataPlan => Boolean(item));
    }

    const key = network.trim().toUpperCase();
    return this.dataPlansByNetwork[key] ?? [];
  }

  private readonly dataPlansByNetwork: Record<string, VtuDataPlan[]> = {
    MTN: [
      {
        code: 'MTN-500MB-30D',
        name: '500MB Monthly',
        amountKobo: 50000n,
        validity: '30 days',
      },
      {
        code: 'MTN-1GB-30D',
        name: '1GB Monthly',
        amountKobo: 100000n,
        validity: '30 days',
      },
      {
        code: 'MTN-2GB-30D',
        name: '2GB Monthly',
        amountKobo: 150000n,
        validity: '30 days',
      },
    ],
    GLO: [
      {
        code: 'GLO-500MB-30D',
        name: '500MB Monthly',
        amountKobo: 45000n,
        validity: '30 days',
      },
      {
        code: 'GLO-1.2GB-30D',
        name: '1.2GB Monthly',
        amountKobo: 95000n,
        validity: '30 days',
      },
      {
        code: 'GLO-2.5GB-30D',
        name: '2.5GB Monthly',
        amountKobo: 145000n,
        validity: '30 days',
      },
    ],
    AIRTEL: [
      {
        code: 'AIRTEL-750MB-14D',
        name: '750MB Bi-weekly',
        amountKobo: 50000n,
        validity: '14 days',
      },
      {
        code: 'AIRTEL-1.5GB-30D',
        name: '1.5GB Monthly',
        amountKobo: 100000n,
        validity: '30 days',
      },
      {
        code: 'AIRTEL-3GB-30D',
        name: '3GB Monthly',
        amountKobo: 150000n,
        validity: '30 days',
      },
    ],
    '9MOBILE': [
      {
        code: '9MOBILE-500MB-30D',
        name: '500MB Monthly',
        amountKobo: 50000n,
        validity: '30 days',
      },
      {
        code: '9MOBILE-1.5GB-30D',
        name: '1.5GB Monthly',
        amountKobo: 110000n,
        validity: '30 days',
      },
      {
        code: '9MOBILE-3GB-30D',
        name: '3GB Monthly',
        amountKobo: 170000n,
        validity: '30 days',
      },
    ],
  };

  private readonly cablePlansByProvider: Record<string, CablePlan[]> = {
    DSTV: [
      {
        code: 'DSTV-COMPACT',
        name: 'DStv Compact',
        amountKobo: 1570000n,
        duration: '30 days',
      },
      {
        code: 'DSTV-COMPACT-PLUS',
        name: 'DStv Compact Plus',
        amountKobo: 2500000n,
        duration: '30 days',
      },
    ],
    GOTV: [
      {
        code: 'GOTV-JINJA',
        name: 'GOtv Jinja',
        amountKobo: 390000n,
        duration: '30 days',
      },
      {
        code: 'GOTV-MAX',
        name: 'GOtv Max',
        amountKobo: 720000n,
        duration: '30 days',
      },
    ],
    STARTIMES: [
      {
        code: 'STARTIMES-CLASSIC',
        name: 'StarTimes Classic',
        amountKobo: 470000n,
        duration: '30 days',
      },
      {
        code: 'STARTIMES-SUPER',
        name: 'StarTimes Super',
        amountKobo: 900000n,
        duration: '30 days',
      },
    ],
  };

  private async loadRuntimeConfig(
    tenantId?: string | null,
  ): Promise<ResolvedProviderOneConfig> {
    const tenantConfig = tenantId
      ? await this.prisma.platformProviderConfig.findUnique({
          where: {
            providerType_providerKey_scopeType_scopeKey: {
              providerType: 'VTU',
              providerKey: 'PROVIDER_ONE',
              scopeType: 'TENANT',
              scopeKey: tenantId,
            },
          },
        })
      : null;

    const savedConfig =
      tenantConfig ??
      (await this.prisma.platformProviderConfig.findUnique({
        where: {
          providerType_providerKey_scopeType_scopeKey: {
            providerType: 'VTU',
            providerKey: 'PROVIDER_ONE',
            scopeType: 'PLATFORM',
            scopeKey: 'platform',
          },
        },
      }));

    const baseUrl = savedConfig?.baseUrl?.trim() || this.baseUrl;
    const apiKey = savedConfig?.apiKeyEncrypted
      ? this.providerCredentialsService.decrypt(savedConfig.apiKeyEncrypted)
      : this.apiKey;
    const rolloutMode = savedConfig?.rolloutMode ?? ProviderRolloutMode.AUTO;
    const isEnabled = savedConfig?.isEnabled ?? true;
    const missingConfig = [
      ...(baseUrl ? [] : ['VTU_PROVIDER_ONE_BASE_URL']),
      ...(apiKey ? [] : ['VTU_PROVIDER_ONE_API_KEY']),
    ];

    const mode =
      !isEnabled || rolloutMode === ProviderRolloutMode.MOCK
        ? 'mock'
        : missingConfig.length === 0
          ? 'live'
          : 'mock';

    return {
      scopeType: tenantConfig ? 'TENANT' : 'PLATFORM',
      scopeKey: tenantConfig ? (tenantId ?? 'platform') : 'platform',
      mode,
      rolloutMode,
      isEnabled,
      missingConfig,
      baseUrl,
      apiKey,
      apiKeyHeader: savedConfig
        ? savedConfig.apiKeyHeader?.trim() || this.apiKeyHeader
        : this.apiKeyHeader,
      apiKeyPrefix: savedConfig
        ? (savedConfig.apiKeyPrefix ?? '')
        : this.apiKeyPrefix,
      healthPath: savedConfig?.healthPath?.trim() || this.healthPath,
      airtimePath: savedConfig?.airtimePath?.trim() || this.airtimePath,
      dataPurchasePath:
        savedConfig?.dataPurchasePath?.trim() || this.dataPurchasePath,
      dataPlansPath: savedConfig?.dataPlansPath?.trim() || this.dataPlansPath,
      cablePlansPath:
        savedConfig?.cablePlansPath?.trim() || this.cablePlansPath,
      cableVerifyPath:
        savedConfig?.cableVerifyPath?.trim() || this.cableVerifyPath,
      cablePurchasePath:
        savedConfig?.cablePurchasePath?.trim() || this.cablePurchasePath,
      electricityVerifyPath:
        savedConfig?.electricityVerifyPath?.trim() ||
        this.electricityVerifyPath,
      electricityPurchasePath:
        savedConfig?.electricityPurchasePath?.trim() ||
        this.electricityPurchasePath,
    };
  }

  private getMockModeMessage(config: ResolvedProviderOneConfig) {
    if (!config.isEnabled) {
      return 'Provider is currently disabled by admin rollout controls.';
    }

    if (config.rolloutMode === ProviderRolloutMode.MOCK) {
      return 'Provider is running in mock mode because rollout is forced to mock.';
    }

    return 'Provider is running in mock mode because live VTU credentials are missing.';
  }

  private async requestJson(
    method: 'GET' | 'POST',
    path: string,
    config: ResolvedProviderOneConfig,
    body?: Record<string, unknown>,
    query?: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const url = new URL(this.normalizePath(path), config.baseUrl);

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value) {
          url.searchParams.set(key, value);
        }
      });
    }

    const response = await fetch(url, {
      method,
      headers: this.buildHeaders(config),
      ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
    });

    const text = await response.text();
    const parsed = text ? this.safeJsonParse(text) : {};

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} from VTU provider at ${url.pathname}`,
      );
    }

    const payload = this.unwrapPayload(parsed);

    if (this.getBoolean(payload, ['success', 'ok']) === false) {
      throw new Error(
        this.getString(payload, ['message', 'error', 'detail']) ??
          'VTU provider request was not successful.',
      );
    }

    return payload;
  }

  private buildHeaders(config: ResolvedProviderOneConfig) {
    const headers = new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });

    if (config.apiKey) {
      headers.set(
        config.apiKeyHeader,
        `${config.apiKeyPrefix}${config.apiKey}`.trim(),
      );
    }

    return headers;
  }

  private normalizePath(path: string) {
    return path.startsWith('/') ? path : `/${path}`;
  }

  private safeJsonParse(value: string): unknown {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return {};
    }
  }

  private unwrapPayload(value: unknown): Record<string, unknown> {
    if (!this.isRecord(value)) {
      return {};
    }

    const candidate = value.data ?? value.result ?? value.payload ?? value;
    return this.isRecord(candidate) ? candidate : value;
  }

  private extractArray(
    value: Record<string, unknown>,
  ): Record<string, unknown>[] {
    const candidates = [
      value.items,
      value.plans,
      value.data,
      value.results,
      value.rows,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.filter((item): item is Record<string, unknown> =>
          this.isRecord(item),
        );
      }
    }

    return Array.isArray(value)
      ? value.filter((item): item is Record<string, unknown> =>
          this.isRecord(item),
        )
      : [];
  }

  private normalizePurchaseResult(
    value: Record<string, unknown>,
    reference: string,
    metadata?: Record<string, unknown>,
  ): VtuPurchaseResult {
    const status = this.normalizePurchaseStatus(
      this.getString(value, ['status', 'transactionStatus', 'state']),
    );

    return {
      success: status !== 'FAILED',
      reference:
        this.getString(value, ['reference', 'requestReference']) ?? reference,
      providerReference:
        this.getString(value, [
          'providerReference',
          'providerRef',
          'transactionId',
          'id',
        ]) ?? reference,
      status,
      metadata: Object.fromEntries(
        Object.entries(metadata ?? {}).filter(([, item]) => item !== undefined),
      ),
    };
  }

  private normalizeCableVerification(
    value: Record<string, unknown>,
    input: VerifyCableSmartcardInput,
  ): VerifyCableSmartcardResult {
    return {
      success: this.getBoolean(value, ['success', 'valid']) ?? true,
      provider: this.getString(value, ['provider', 'biller']) ?? input.provider,
      smartcardNumber:
        this.getString(value, ['smartcardNumber', 'iuc', 'smartCard']) ??
        input.smartcardNumber,
      customerName:
        this.getString(value, ['customerName', 'name', 'customer']) ??
        `${input.provider} Viewer`,
      currentPlan: this.getString(value, [
        'currentPlan',
        'planName',
        'package',
      ]),
      dueDate: this.getString(value, ['dueDate', 'renewalDate', 'expiryDate']),
      status: this.normalizeVerificationStatus(
        this.getString(value, ['status', 'verificationStatus']),
      ),
    };
  }

  private normalizeElectricityVerification(
    value: Record<string, unknown>,
    input: VerifyElectricityMeterInput,
  ): VerifyElectricityMeterResult {
    return {
      success: this.getBoolean(value, ['success', 'valid']) ?? true,
      disco: this.getString(value, ['disco', 'provider']) ?? input.disco,
      meterNumber:
        this.getString(value, ['meterNumber', 'meterNo']) ?? input.meterNumber,
      meterType:
        (this.getString(value, ['meterType', 'type'])?.toUpperCase() as
          | 'PREPAID'
          | 'POSTPAID'
          | undefined) ?? input.meterType,
      customerName:
        this.getString(value, ['customerName', 'name', 'customer']) ??
        `${input.disco} Customer`,
      address: this.getString(value, ['address', 'serviceAddress']),
      status: this.normalizeVerificationStatus(
        this.getString(value, ['status', 'verificationStatus']),
      ),
    };
  }

  private normalizeDataPlan(
    value: Record<string, unknown>,
  ): VtuDataPlan | null {
    const code = this.getString(value, ['code', 'planCode', 'id']);
    const name = this.getString(value, ['name', 'planName']);
    const amount = this.getBigInt(value, ['amountKobo', 'amount', 'price']);

    if (!code || !name || amount === null) {
      return null;
    }

    return {
      code,
      name,
      amountKobo: amount,
      validity:
        this.getString(value, ['validity', 'duration', 'validFor']) ??
        '30 days',
    };
  }

  private normalizeCablePlan(value: Record<string, unknown>): CablePlan | null {
    const code = this.getString(value, ['code', 'planCode', 'id']);
    const name = this.getString(value, ['name', 'planName']);
    const amount = this.getBigInt(value, ['amountKobo', 'amount', 'price']);

    if (!code || !name || amount === null) {
      return null;
    }

    return {
      code,
      name,
      amountKobo: amount,
      duration:
        this.getString(value, ['duration', 'validity', 'period']) ?? '30 days',
    };
  }

  private normalizePurchaseStatus(
    value: string | undefined,
  ): 'PENDING' | 'SUCCESS' | 'FAILED' {
    const normalized = value?.trim().toUpperCase();

    if (!normalized) {
      return 'SUCCESS';
    }

    if (['SUCCESS', 'COMPLETED', 'DELIVERED', 'OK'].includes(normalized)) {
      return 'SUCCESS';
    }

    if (['PENDING', 'PROCESSING', 'QUEUED'].includes(normalized)) {
      return 'PENDING';
    }

    return 'FAILED';
  }

  private normalizeVerificationStatus(value: string | undefined) {
    const normalized = value?.trim().toUpperCase();
    return normalized === 'INVALID' ? 'INVALID' : 'VALID';
  }

  private getString(
    value: Record<string, unknown>,
    keys: string[],
  ): string | undefined {
    for (const key of keys) {
      const candidate = value[key];
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return undefined;
  }

  private getBoolean(
    value: Record<string, unknown>,
    keys: string[],
  ): boolean | undefined {
    for (const key of keys) {
      const candidate = value[key];
      if (typeof candidate === 'boolean') {
        return candidate;
      }
    }

    return undefined;
  }

  private getNumber(
    value: Record<string, unknown>,
    keys: string[],
  ): number | undefined {
    for (const key of keys) {
      const candidate = value[key];
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        return candidate;
      }
      if (typeof candidate === 'string' && candidate.trim()) {
        const parsed = Number(candidate);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }

    return undefined;
  }

  private getBigInt(
    value: Record<string, unknown>,
    keys: string[],
  ): bigint | null {
    for (const key of keys) {
      const candidate = value[key];
      if (typeof candidate === 'bigint') {
        return candidate;
      }
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        return BigInt(Math.round(candidate));
      }
      if (typeof candidate === 'string' && candidate.trim()) {
        try {
          return BigInt(candidate);
        } catch {
          const parsed = Number(candidate);
          if (Number.isFinite(parsed)) {
            return BigInt(Math.round(parsed));
          }
        }
      }
    }

    return null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private logMockUsage(serviceType: string, reference: string): void {
    if (this.providerMode === 'mock') {
      this.logger.warn(
        `VTU provider credentials are not fully configured — returning mocked ${serviceType} result for ${reference}`,
      );
    }
  }
}
