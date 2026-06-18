import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as https from 'https';
import * as http from 'http';
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
 * FintavaPay payment provider — per-transaction virtual account based.
 * Docs: https://fintava.readme.io/reference/generate-virtual-wallet
 *
 * Key integration facts:
 *  - Endpoint: POST /virtual-wallet/generate — generates a one-time virtual account.
 *  - Base URL: https://dev.fintavapay.com/api/dev (both sandbox and live use this URL;
 *    environment is determined by the API key, not the URL).
 *  - Request amounts are in whole Naira (float). Fintava rejects decimals.
 *  - Webhook payload amounts are in Kobo — store directly as BigInt (do NOT multiply by 100).
 *  - Webhook signature header: "x-fintava-signature" — may be hex OR base64 HMAC-SHA512.
 *  - Force IPv4 (family: 4) on every outbound call — Fintava DNS occasionally returns IPv6
 *    on Fly.io, causing indefinite hangs.
 *  - Hard 5-second timeout — mobile clients drop idle connections at ~8-10s; Fintava can
 *    take 3-6s. Race every request against 5s so the API always responds first.
 */

// Axios agents that force IPv4 on all outbound Fintava calls.
const IPV4_HTTP_AGENT  = new http.Agent({ family: 4 });
const IPV4_HTTPS_AGENT = new https.Agent({ family: 4 });

/** Hard cap in ms — must finish before Fly proxy + mobile browser drops the connection. */
const REQUEST_TIMEOUT_MS = 5_000;

@Injectable()
export class FintavapayProvider implements IPaymentProvider {
  readonly gatewayName = 'FINTAVAPAY';
  private readonly logger = new Logger(FintavapayProvider.name);
  private readonly baseUrl: string;
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config
      .get<string>('FINTAVAPAY_BASE_URL', 'https://dev.fintavapay.com/api/dev')
      .trim()
      .replace(/\/+$/, '');

    this.secretKey    = config.get<string>('FINTAVAPAY_SECRET_KEY', '');
    this.webhookSecret = config.get<string>('FINTAVAPAY_WEBHOOK_SECRET', '');
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  /** Shared axios config: auth headers + IPv4 forcing + hard timeout. */
  private get axiosConfig() {
    return {
      headers:    this.headers,
      timeout:    REQUEST_TIMEOUT_MS,
      httpAgent:  IPV4_HTTP_AGENT,
      httpsAgent: IPV4_HTTPS_AGENT,
    };
  }

  /** Convert Kobo (BigInt) → whole Naira for outbound API requests. */
  private koboToNaira(kobo: bigint): number {
    return Math.floor(Number(kobo) / 100);
  }

  /** Convert Naira float → Kobo BigInt for internal storage (verifyPayment responses). */
  private nairaToKobo(naira: number): bigint {
    return BigInt(Math.round(naira * 100));
  }

  async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResult> {
    const expireMinutes = input.expireTimeInMin ?? 30;
    const amountNaira   = this.koboToNaira(input.amountKobo);

    const response = await axios.post(
      `${this.baseUrl}/virtual-wallet/generate`,
      {
        customerName:      input.customerName ?? input.email,
        phone:             input.phone ?? '',
        email:             input.email,
        amount:            amountNaira,
        expireTimeInMin:   expireMinutes,
        merchantReference: input.reference,
        description:       'ZenDocx wallet funding',
      },
      this.axiosConfig,
    );

    // Fintava wraps the result — handle both flat and nested response shapes.
    const raw  = response.data as Record<string, unknown>;
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
      paymentUrl: undefined,
      virtualAccount: { accountNumber, bankName, expiresAt },
    };
  }

  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    const response = await axios.get(
      `${this.baseUrl}/transaction/reference/${reference}`,
      this.axiosConfig,
    );

    const raw  = response.data as Record<string, unknown>;
    const data = (raw['data'] ?? raw) as Record<string, unknown>;

    const status  = (data['status'] as string | undefined)?.toLowerCase() ?? '';
    const success =
      status === 'success' || status === 'successful' || status === 'completed';

    // verifyPayment response amounts are in Naira — convert to Kobo for internal storage.
    const rawAmount  = data['amount'] as number | undefined;
    const amountKobo = rawAmount !== undefined ? this.nairaToKobo(rawAmount) : 0n;

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
        accountNumber:     input.accountNumber,
        accountName:       input.accountName,
        sortCode:          input.bankCode,
        amount:            amountNaira,
        CustomerReference: input.reference,
        narration:         input.narration,
      },
      this.axiosConfig,
    );

    const raw  = response.data as Record<string, unknown>;
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
      const response = await axios.get(`${this.baseUrl}/bank/list`, this.axiosConfig);

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
      this.logger.warn('FINTAVAPAY_WEBHOOK_SECRET not configured — rejecting webhook');
      return empty;
    }

    // Fintava may send the HMAC digest as hex OR base64 — try both.
    const computedHex    = crypto.createHmac('sha512', this.webhookSecret).update(rawBody).digest('hex');
    const computedBase64 = crypto.createHmac('sha512', this.webhookSecret).update(rawBody).digest('base64');

    const signatureValid =
      this.safeSignatureEqual(signatureHeader, computedHex, 'hex') ||
      this.safeSignatureEqual(signatureHeader, computedBase64, 'base64') ||
      signatureHeader === computedHex ||
      signatureHeader === computedBase64;

    if (!signatureValid) {
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

    const event =
      (body['type'] as string | undefined) ??
      (body['event'] as string | undefined) ??
      '';

    const data = (body['data'] ?? {}) as Record<string, unknown>;

    const reference =
      (data['merchantReference'] as string | undefined) ??
      (data['CustomerReference'] as string | undefined) ??
      (data['customerReference'] as string | undefined) ??
      (data['reference'] as string | undefined) ??
      '';

    // IMPORTANT: Webhook payload amounts are in Kobo (not Naira).
    // e.g. amount: 500000 = ₦5,000. Store the raw value directly as BigInt.
    const rawAmount  = data['amount'] as number | undefined;
    const amountKobo = rawAmount !== undefined ? BigInt(Math.floor(rawAmount)) : 0n;

    const gatewayRef =
      (data['id'] as string | undefined) ??
      (data['transactionId'] as string | undefined) ??
      '';

    return { isValid: true, event, reference, amountKobo, gatewayRef };
  }

  /** Timing-safe comparison for HMAC signatures. Returns false on any error. */
  private safeSignatureEqual(
    incoming: string,
    computed: string,
    encoding: BufferEncoding,
  ): boolean {
    try {
      const inBuf  = Buffer.from(incoming, encoding);
      const expBuf = Buffer.from(computed, encoding);
      if (inBuf.length === 0 || inBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(inBuf, expBuf);
    } catch {
      return false;
    }
  }
}
