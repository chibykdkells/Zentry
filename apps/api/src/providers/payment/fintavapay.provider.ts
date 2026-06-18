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
 * FintavaPay payment provider — virtual-account (NIP transfer) based.
 * Docs: https://fintava.readme.io/reference/getting-started-with-fintava-api
 *
 * Key differences from redirect-based gateways (Paystack/Flutterwave):
 *  - Payment initiation returns a virtual bank account, not a checkout URL.
 *    The user transfers money to the account via their bank app.
 *  - Amounts in API requests/responses are Naira (float), not Kobo.
 *    We convert: amountKobo / 100n → Naira for requests,
 *                responseNaira * 100 → Kobo for internal storage.
 *  - Webhook event for successful funding: "account_funded"
 *  - Webhook signature header: "x-fintava-signature" (HMAC-SHA512)
 *  - Payouts: POST /bank/credit/merchant (uses sortCode, not bank_code)
 */
@Injectable()
export class FintavapayProvider implements IPaymentProvider {
  readonly gatewayName = 'FINTAVAPAY';
  private readonly logger = new Logger(FintavapayProvider.name);
  private readonly baseUrl: string;
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  /** Default virtual account lifetime in minutes */
  private readonly DEFAULT_EXPIRE_MINUTES = 30;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config
      .get<string>('FINTAVAPAY_BASE_URL', 'https://dev.fintavapay.com/api/dev')
      .replace(/\/+$/, '');
    this.secretKey = config.get<string>('FINTAVAPAY_SECRET_KEY', '');
    this.webhookSecret = config.get<string>('FINTAVAPAY_WEBHOOK_SECRET', '');
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  /** Convert Kobo (BigInt) → Naira float for API requests */
  private koboToNaira(kobo: bigint): number {
    return Number(kobo) / 100;
  }

  /** Convert Naira float → Kobo BigInt for internal storage */
  private nairaToKobo(naira: number): bigint {
    return BigInt(Math.round(naira * 100));
  }

  async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResult> {
    const expireMinutes = input.expireTimeInMin ?? this.DEFAULT_EXPIRE_MINUTES;
    const amountNaira = this.koboToNaira(input.amountKobo);

    const response = await axios.post(
      `${this.baseUrl}/virtual-wallet/generate`,
      {
        customerName: input.customerName ?? input.email,
        phone: input.phone ?? '',
        email: input.email,
        amount: amountNaira,
        expireTimeInMin: expireMinutes,
        merchantReference: input.reference,
        description: 'ZenDocx wallet funding',
      },
      { headers: this.headers },
    );

    // Fintava wraps the result; handle both flat and nested response shapes
    const raw = response.data as Record<string, unknown>;
    const data = (raw['data'] ?? raw) as Record<string, unknown>;

    const accountNumber =
      (data['accountNumber'] as string | undefined) ??
      (data['account_number'] as string | undefined) ??
      '';

    const bankName =
      (data['bankName'] as string | undefined) ??
      (data['bank_name'] as string | undefined) ??
      (data['bank'] as string | undefined) ??
      '';

    const gatewayRef =
      (data['id'] as string | undefined) ??
      (data['walletId'] as string | undefined) ??
      (data['reference'] as string | undefined) ??
      input.reference;

    const expiresAt = new Date(Date.now() + expireMinutes * 60 * 1000);

    return {
      reference: input.reference,
      gatewayRef,
      // No redirect URL — FintavaPay uses bank transfer
      paymentUrl: undefined,
      virtualAccount: { accountNumber, bankName, expiresAt },
    };
  }

  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    const response = await axios.get(
      `${this.baseUrl}/transaction/reference/${reference}`,
      { headers: this.headers },
    );

    const raw = response.data as Record<string, unknown>;
    const data = (raw['data'] ?? raw) as Record<string, unknown>;

    const status =
      (data['status'] as string | undefined)?.toLowerCase() ?? '';
    const success = status === 'success' || status === 'successful' || status === 'completed';

    // FintavaPay API docs state amounts are always in Naira (float).
    const rawAmount = data['amount'] as number | undefined;
    const amountKobo =
      rawAmount !== undefined ? this.nairaToKobo(rawAmount) : 0n;

    const gatewayRef =
      (data['id'] as string | undefined) ??
      (data['transactionId'] as string | undefined) ??
      (data['transaction_id'] as string | undefined) ??
      reference;

    const paidAtRaw =
      (data['paidAt'] as string | undefined) ??
      (data['paid_at'] as string | undefined) ??
      (data['createdAt'] as string | undefined);

    return {
      success,
      amountKobo,
      reference,
      gatewayRef,
      paidAt: paidAtRaw ? new Date(paidAtRaw) : undefined,
    };
  }

  async initiateTransfer(
    input: InitiateTransferInput,
  ): Promise<InitiateTransferResult> {
    const amountNaira = this.koboToNaira(input.amountKobo);

    const response = await axios.post(
      `${this.baseUrl}/bank/credit/merchant`,
      {
        accountNumber: input.accountNumber,
        accountName: input.accountName,
        sortCode: input.bankCode,
        amount: amountNaira,
        CustomerReference: input.reference,
        narration: input.narration,
      },
      { headers: this.headers },
    );

    const raw = response.data as Record<string, unknown>;
    const data = (raw['data'] ?? raw) as Record<string, unknown>;

    const statusRaw = (data['status'] as string | undefined)?.toLowerCase() ?? '';
    const status: 'SUCCESS' | 'PENDING' =
      statusRaw === 'success' || statusRaw === 'successful' ? 'SUCCESS' : 'PENDING';

    const transferRef =
      (data['reference'] as string | undefined) ??
      (data['CustomerReference'] as string | undefined) ??
      input.reference;

    const gatewayRef =
      (data['id'] as string | undefined) ??
      (data['transactionId'] as string | undefined) ??
      transferRef;

    return { transferRef, gatewayRef, status };
  }

  async getBanks(): Promise<BankListItem[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/bank/list`, {
        headers: this.headers,
      });

      const raw = response.data as unknown;
      let list: { sortCode?: string; code?: string; name?: string; bankName?: string }[] = [];

      if (Array.isArray(raw)) {
        list = raw as typeof list;
      } else if (raw !== null && typeof raw === 'object' && 'data' in raw) {
        const nested = (raw as { data: unknown }).data;
        if (Array.isArray(nested)) list = nested as typeof list;
      }

      return list
        .filter((b) => b && (b.sortCode ?? b.code) && (b.name ?? b.bankName))
        .map((b) => ({
          code: (b.sortCode ?? b.code ?? '').trim(),
          name: (b.name ?? b.bankName ?? '').trim(),
        }));
    } catch {
      this.logger.warn('FintavaPay bank list unavailable — returning empty list');
      return [];
    }
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

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody.toString()) as Record<string, unknown>;
    } catch {
      this.logger.warn('FintavaPay webhook body is not valid JSON');
      return empty;
    }

    // Fintava uses "type" for the event name (not "event")
    const event =
      (body['type'] as string | undefined) ??
      (body['event'] as string | undefined) ??
      '';

    const data = (body['data'] ?? {}) as Record<string, unknown>;

    const reference =
      (data['merchantReference'] as string | undefined) ??
      (data['reference'] as string | undefined) ??
      (data['CustomerReference'] as string | undefined) ??
      '';

    // FintavaPay API docs state amounts are always in Naira (float).
    const rawAmount = data['amount'] as number | undefined;
    const amountKobo =
      rawAmount !== undefined ? this.nairaToKobo(rawAmount) : 0n;

    const gatewayRef =
      (data['id'] as string | undefined) ??
      (data['transactionId'] as string | undefined) ??
      '';

    return { isValid: true, event, reference, amountKobo, gatewayRef };
  }
}
