import { Inject, Injectable } from '@nestjs/common';
import {
  AirtimePurchaseInput,
  DataPurchaseInput,
  IVtuProvider,
  VTU_PROVIDER,
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

  purchaseAirtime(input: AirtimePurchaseInput): Promise<VtuPurchaseResult> {
    return this.provider.purchaseAirtime(input);
  }

  purchaseData(input: DataPurchaseInput): Promise<VtuPurchaseResult> {
    return this.provider.purchaseData(input);
  }
}
