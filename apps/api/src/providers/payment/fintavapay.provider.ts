import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import type {
  BankListItem,
  IPaymentProvider,
  InitiatePaymentInput,
  InitiatePaymentResult,
  InitiateTransferInput,
  InitiateTransferResult,
  VerifyPaymentResult,
  WebhookParseResult,
} from '../interfaces';

/**
 * FintavaPay payment provider.
 * NOTE: Update endpoints/field names once FintavaPay API docs are reviewed.
 * All amounts are in Kobo — FintavaPay (Nigerian gateway) uses Kobo natively.
 */
@Injectable()
export class FintavapayProvider implements IPaymentProvider {
  readonly gatewayName = 'FINTAVAPAY';
  private readonly logger = new Logger(FintavapayProvider.name);
  private readonly baseUrl: string;
  private readonly publicKey: string;
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>(
      'FINTAVAPAY_BASE_URL',
      'https://api.fintavapay.com',
    );
    this.publicKey = config.get<string>('FINTAVAPAY_PUBLIC_KEY', '');
    this.secretKey = config.get<string>('FINTAVAPAY_SECRET_KEY', '');
    this.webhookSecret = config.get<string>('FINTAVAPAY_WEBHOOK_SECRET', '');
  }

  async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResult> {
    const response = await axios.post(
      `${this.baseUrl}/v1/transaction/initialize`,
      {
        amount: Number(input.amountKobo),
        email: input.email,
        reference: input.reference,
        callback_url: input.callbackUrl,
        public_key: this.publicKey,
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
      data: { payment_url: string; reference: string; access_code: string };
    };

    return {
      paymentUrl: data.payment_url,
      reference: data.reference,
      gatewayRef: data.access_code,
    };
  }

  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    const response = await axios.get(
      `${this.baseUrl}/v1/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${this.secretKey}` },
      },
    );

    const { data } = response.data as {
      data: {
        status: string;
        amount: number;
        reference: string;
        id: string;
        paid_at: string;
      };
    };

    return {
      success: data.status === 'success',
      amountKobo: BigInt(data.amount),
      reference: data.reference,
      gatewayRef: data.id,
      paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
    };
  }

  async initiateTransfer(
    input: InitiateTransferInput,
  ): Promise<InitiateTransferResult> {
    const response = await axios.post(
      `${this.baseUrl}/v1/transfer/initiate`,
      {
        amount: Number(input.amountKobo),
        account_number: input.accountNumber,
        bank_code: input.bankCode,
        account_name: input.accountName,
        reference: input.reference,
        narration: input.narration,
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
        reference: string;
        transfer_code: string;
        status: string;
      };
    };

    const status =
      data.status?.toLowerCase() === 'success' ? 'SUCCESS' : 'PENDING';

    return {
      transferRef: data.reference ?? input.reference,
      gatewayRef: data.transfer_code ?? data.reference,
      status,
    };
  }

  async getBanks(): Promise<BankListItem[]> {
    const response = await axios.get(`${this.baseUrl}/v1/banks`, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    });

    const raw: unknown = response.data;
    let list: { code: string; name: string }[] = [];

    if (Array.isArray(raw)) {
      list = raw as { code: string; name: string }[];
    } else if (
      raw !== null &&
      typeof raw === 'object' &&
      'data' in raw &&
      Array.isArray((raw as { data: unknown }).data)
    ) {
      list = (raw as { data: { code: string; name: string }[] }).data;
    }

    return list
      .filter(
        (b) => b && typeof b.code === 'string' && typeof b.name === 'string',
      )
      .map((b) => ({ code: b.code.trim(), name: b.name.trim() }));
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
        'FINTAVAPAY_WEBHOOK_SECRET not configured — rejecting webhook',
      );
      return empty;
    }

    const hash = crypto
      .createHmac('sha512', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (hash !== signatureHeader) {
      this.logger.warn('FintavaPay webhook signature mismatch');
      return empty;
    }

    const body = JSON.parse(rawBody.toString()) as {
      event: string;
      data: { reference: string; amount: number; id: string };
    };

    return {
      isValid: true,
      event: body.event,
      reference: body.data.reference,
      amountKobo: BigInt(body.data.amount),
      gatewayRef: body.data.id,
    };
  }
}
