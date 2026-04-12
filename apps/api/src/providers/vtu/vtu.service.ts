import { Inject, Injectable } from '@nestjs/common';
import {
  AirtimePurchaseInput,
  CablePlan,
  CablePurchaseInput,
  DataPurchaseInput,
  ElectricityPurchaseInput,
  IVtuProvider,
  VtuDataPlan,
  VtuProviderReadiness,
  VtuScopeInput,
  VTU_PROVIDER,
  VerifyCableSmartcardInput,
  VerifyCableSmartcardResult,
  VerifyElectricityMeterInput,
  VerifyElectricityMeterResult,
  VtuPurchaseResult,
} from '../interfaces';

@Injectable()
export class VtuService {
  constructor(
    @Inject(VTU_PROVIDER)
    private readonly provider: IVtuProvider,
  ) {}

  get providerName(): string {
    return this.provider.providerName;
  }

  get providerMode(): 'live' | 'mock' {
    return this.provider.providerMode;
  }

  getReadiness(input?: VtuScopeInput): Promise<VtuProviderReadiness> {
    return this.provider.getReadiness(input);
  }

  purchaseAirtime(input: AirtimePurchaseInput): Promise<VtuPurchaseResult> {
    return this.provider.purchaseAirtime(input);
  }

  purchaseData(input: DataPurchaseInput): Promise<VtuPurchaseResult> {
    return this.provider.purchaseData(input);
  }

  getDataPlans(
    network: string,
    tenantId?: string | null,
  ): Promise<VtuDataPlan[]> {
    return this.provider.getDataPlans(network, tenantId);
  }

  getCablePlans(
    provider: string,
    tenantId?: string | null,
  ): Promise<CablePlan[]> {
    return this.provider.getCablePlans(provider, tenantId);
  }

  verifyCableSmartcard(
    input: VerifyCableSmartcardInput,
  ): Promise<VerifyCableSmartcardResult> {
    return this.provider.verifyCableSmartcard(input);
  }

  purchaseCable(input: CablePurchaseInput): Promise<VtuPurchaseResult> {
    return this.provider.purchaseCable(input);
  }

  verifyElectricityMeter(
    input: VerifyElectricityMeterInput,
  ): Promise<VerifyElectricityMeterResult> {
    return this.provider.verifyElectricityMeter(input);
  }

  purchaseElectricity(
    input: ElectricityPurchaseInput,
  ): Promise<VtuPurchaseResult> {
    return this.provider.purchaseElectricity(input);
  }
}
