import { Inject, Injectable } from '@nestjs/common';
import {
  BankListItem,
  InitiatePaymentInput,
  InitiatePaymentResult,
  InitiateTransferInput,
  InitiateTransferResult,
  IPaymentProvider,
  PAYMENT_PROVIDER,
  VerifyPaymentResult,
  WebhookParseResult,
} from '../interfaces';

@Injectable()
export class PaymentService {
  constructor(
    @Inject(PAYMENT_PROVIDER)
    private readonly provider: IPaymentProvider,
  ) {}

  get gatewayName(): string {
    return this.provider.gatewayName;
  }

  private createDevelopmentCheckoutUrl(
    callbackUrl: string,
    gatewayName: string,
    reference: string,
  ) {
    const checkoutUrl = new URL(callbackUrl);
    checkoutUrl.searchParams.set('mockGateway', gatewayName);
    checkoutUrl.searchParams.set('reference', reference);
    checkoutUrl.searchParams.set('checkout', 'sandbox');
    return checkoutUrl.toString();
  }

  initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    return this.provider.initiatePayment(input).catch((error: unknown) => {
      if (process.env.NODE_ENV !== 'development') {
        throw error instanceof Error
          ? error
          : new Error('Payment initiation failed');
      }

      // Dev sandbox fallback — only possible when callbackUrl is set (redirect-based flow)
      if (!input.callbackUrl) {
        throw error instanceof Error
          ? error
          : new Error('Payment initiation failed (no callbackUrl for sandbox fallback)');
      }
      return {
        paymentUrl: this.createDevelopmentCheckoutUrl(
          input.callbackUrl,
          this.gatewayName,
          input.reference,
        ),
        reference: input.reference,
        gatewayRef: `sandbox-${input.reference}`,
        mode: 'sandbox' as const,
      };
    });
  }

  verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    return this.provider.verifyPayment(reference);
  }

  parseWebhook(rawBody: Buffer, signatureHeader: string): WebhookParseResult {
    return this.provider.parseWebhook(rawBody, signatureHeader);
  }

  initiateTransfer(
    input: InitiateTransferInput,
  ): Promise<InitiateTransferResult> {
    return this.provider.initiateTransfer(input);
  }

  getBanks(): Promise<BankListItem[]> {
    return this.provider.getBanks();
  }
}
