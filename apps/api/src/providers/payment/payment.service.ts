import { Inject, Injectable } from '@nestjs/common';
import {
  InitiatePaymentInput,
  InitiatePaymentResult,
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
}
