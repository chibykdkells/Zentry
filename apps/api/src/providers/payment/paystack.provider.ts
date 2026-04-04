import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import type {
  IPaymentProvider,
  InitiatePaymentInput,
  InitiatePaymentResult,
  VerifyPaymentResult,
  WebhookParseResult,
} from '../interfaces';

/**
 * Paystack payment provider (Backup #1).
 * Docs: https://paystack.com/docs/api/
 * Amounts: Paystack uses Kobo natively (same as Zentry's internal format).
 */
@Injectable()
export class PaystackProvider implements IPaymentProvider {
  readonly gatewayName = 'PAYSTACK';
  private readonly logger = new Logger(PaystackProvider.name);
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    this.secretKey = config.get<string>('PAYSTACK_SECRET_KEY', '');
    this.webhookSecret = config.get<string>('PAYSTACK_WEBHOOK_SECRET', '');
  }

  async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResult> {
    const response = await axios.post(
      `${this.baseUrl}/transaction/initialize`,
      {
        amount: Number(input.amountKobo), // Paystack accepts Kobo as integer
        email: input.email,
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
      },
      {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const { data } = response.data as {
      data: {
        authorization_url: string;
        reference: string;
        access_code: string;
      };
    };

    return {
      paymentUrl: data.authorization_url,
      reference: data.reference,
      gatewayRef: data.access_code,
    };
  }

  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    const response = await axios.get(
      `${this.baseUrl}/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${this.secretKey}` },
      },
    );

    const { data } = response.data as {
      data: {
        status: string;
        amount: number;
        reference: string;
        id: number;
        paid_at: string;
      };
    };

    return {
      success: data.status === 'success',
      amountKobo: BigInt(data.amount),
      reference: data.reference,
      gatewayRef: data.id.toString(),
      paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
    };
  }

  parseWebhook(rawBody: Buffer, signatureHeader: string): WebhookParseResult {
    const empty: WebhookParseResult = {
      isValid: false,
      event: '',
      reference: '',
      amountKobo: 0n,
      gatewayRef: '',
    };

    if (!this.webhookSecret) {
      this.logger.warn(
        'PAYSTACK_WEBHOOK_SECRET not configured — rejecting webhook',
      );
      return empty;
    }

    const hash = crypto
      .createHmac('sha512', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (hash !== signatureHeader) {
      this.logger.warn('Paystack webhook signature mismatch');
      return empty;
    }

    const body = JSON.parse(rawBody.toString()) as {
      event: string;
      data: { reference: string; amount: number; id: number };
    };

    return {
      isValid: true,
      event: body.event,
      reference: body.data.reference,
      amountKobo: BigInt(body.data.amount),
      gatewayRef: body.data.id.toString(),
    };
  }
}
