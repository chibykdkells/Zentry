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
 * Flutterwave payment provider (Backup #2).
 * Docs: https://developer.flutterwave.com/docs
 * Amounts: Flutterwave uses Naira (we convert from Kobo internally).
 * Webhook: uses X-Flutterwave-Signature header (SHA256 HMAC).
 */
@Injectable()
export class FlutterwaveProvider implements IPaymentProvider {
  readonly gatewayName = 'FLUTTERWAVE';
  private readonly logger = new Logger(FlutterwaveProvider.name);
  private readonly baseUrl = 'https://api.flutterwave.com/v3';
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    this.secretKey = config.get<string>('FLUTTERWAVE_SECRET_KEY', '');
    this.webhookSecret = config.get<string>('FLUTTERWAVE_WEBHOOK_SECRET', '');
  }

  async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResult> {
    // Flutterwave uses Naira (divide Kobo by 100)
    const amountNaira = Number(input.amountKobo) / 100;

    const response = await axios.post(
      `${this.baseUrl}/payments`,
      {
        amount: amountNaira,
        currency: 'NGN',
        tx_ref: input.reference,
        redirect_url: input.callbackUrl,
        customer: { email: input.email },
        meta: input.metadata,
      },
      {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const { data } = response.data as {
      data: { link: string };
    };

    return {
      paymentUrl: data.link,
      reference: input.reference,
      gatewayRef: input.reference, // Flutterwave uses tx_ref as identifier
    };
  }

  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    // Flutterwave verifies by tx_ref (our reference)
    const response = await axios.get(
      `${this.baseUrl}/transactions?tx_ref=${reference}`,
      {
        headers: { Authorization: `Bearer ${this.secretKey}` },
      },
    );

    const result = response.data as {
      data: Array<{
        status: string;
        amount: number;
        tx_ref: string;
        id: number;
        created_at: string;
      }>;
    };

    const tx = result.data[0];
    if (!tx) {
      return { success: false, amountKobo: 0n, reference, gatewayRef: '' };
    }

    // Flutterwave returns Naira — convert to Kobo
    const amountKobo = BigInt(Math.round(tx.amount * 100));

    return {
      success: tx.status === 'successful',
      amountKobo,
      reference: tx.tx_ref,
      gatewayRef: tx.id.toString(),
      paidAt: tx.created_at ? new Date(tx.created_at) : undefined,
    };
  }

  async initiateTransfer(
    input: InitiateTransferInput,
  ): Promise<InitiateTransferResult> {
    // Flutterwave transfer uses Naira
    const amountNaira = Number(input.amountKobo) / 100;

    const response = await axios.post(
      `${this.baseUrl}/transfers`,
      {
        account_bank: input.bankCode,
        account_number: input.accountNumber,
        amount: amountNaira,
        currency: 'NGN',
        narration: input.narration,
        reference: input.reference,
        beneficiary_name: input.accountName,
      },
      {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const { data } = response.data as {
      data: { reference: string; id: number; status: string };
    };

    return {
      transferRef: data.reference ?? input.reference,
      gatewayRef: data.id?.toString() ?? data.reference,
      status:
        data.status?.toLowerCase() === 'successful' ? 'SUCCESS' : 'PENDING',
    };
  }

  async getBanks(): Promise<BankListItem[]> {
    const response = await axios.get(`${this.baseUrl}/banks/NG`, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    });

    const { data } = response.data as {
      data: { code: string; name: string }[];
    };

    return (data ?? [])
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
        'FLUTTERWAVE_WEBHOOK_SECRET not configured — rejecting webhook',
      );
      return empty;
    }

    // Flutterwave uses SHA256 HMAC
    const hash = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (hash !== signatureHeader) {
      this.logger.warn('Flutterwave webhook signature mismatch');
      return empty;
    }

    const body = JSON.parse(rawBody.toString()) as {
      event: string;
      data: { tx_ref: string; amount: number; id: number };
    };

    // Convert Naira → Kobo
    const amountKobo = BigInt(Math.round(body.data.amount * 100));

    return {
      isValid: true,
      event: body.event,
      reference: body.data.tx_ref,
      amountKobo,
      gatewayRef: body.data.id.toString(),
    };
  }
}
