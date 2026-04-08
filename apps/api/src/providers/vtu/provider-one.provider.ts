import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AirtimePurchaseInput,
  DataPurchaseInput,
  IVtuProvider,
  VtuPurchaseResult,
} from '../interfaces';

@Injectable()
export class ProviderOneVtuProvider implements IVtuProvider {
  readonly providerName = 'PROVIDER_ONE';
  private readonly logger = new Logger(ProviderOneVtuProvider.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('VTU_PROVIDER_ONE_BASE_URL', '');
    this.apiKey = config.get<string>('VTU_PROVIDER_ONE_API_KEY', '');
  }

  purchaseAirtime(input: AirtimePurchaseInput): Promise<VtuPurchaseResult> {
    this.logMockUsage('airtime', input.reference);

    return Promise.resolve({
      success: true,
      reference: input.reference,
      providerReference: `vtu-airtime-${input.reference}`,
      status: 'SUCCESS',
    });
  }

  purchaseData(input: DataPurchaseInput): Promise<VtuPurchaseResult> {
    this.logMockUsage('data', input.reference);

    return Promise.resolve({
      success: true,
      reference: input.reference,
      providerReference: `vtu-data-${input.reference}`,
      status: 'SUCCESS',
    });
  }

  private logMockUsage(serviceType: string, reference: string): void {
    if (!this.baseUrl || !this.apiKey) {
      this.logger.warn(
        `VTU provider credentials are not fully configured — returning mocked ${serviceType} result for ${reference}`,
      );
    }
  }
}
