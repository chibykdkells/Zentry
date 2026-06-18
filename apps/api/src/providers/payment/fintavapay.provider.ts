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
 * FintavaPay payment provider — static virtual account (Loma Bank NUBAN) based.
 * Docs: FINTAVA_INTEGRATION.md in repo root
 *
 * Key integration facts:
 *  - Both sandbox and live use the same base URL (https://apifintavapay.com/api/dev).
 *    The environment is determined by which API key is provided.
 *  - Each customer gets a permanent Loma Bank NUBAN via POST /create/customer.
 *    There are no per-transaction virtual accounts.
 *  - Request amounts are in whole Naira (float).
 *  - Webhook payload amounts are in Kobo (divide by 100 or store raw as Kobo).
 *  - Webhook signature header: "x-fintava-signature" — may be hex OR base64 HMAC-SHA512.
 *  - Force IPv4 (family: 4) — Fintava DNS occasionally returns IPv6 on Fly.io, hanging
 *    indefinitely. Apply to every outbound HTTP call.
 *  - Hard 5-second timeout — mobile clients drop idle connections at ~8-10s. Fintava can
 *    take 3-6s. Race every request against a 5s timer so the API always responds first.
 */

// Axios agents that force IPv4 on all outbound Fintava calls.
const IPV4_HTTP_AGENT  = new http.Agent({ family: 4 });
const IPV4_HTTPS_AGENT = new https.Agent({ family: 4 });

/** Hard cap in ms — must be shorter than Fly proxy + mobile connection drop (~8-10s). */
const REQUEST_TIMEOUT_MS = 5_000;

@Injectable()
export class FintavapayProvider implements IPaymentProvider {
  readonly gatewayName = 'FINTAVAPAY';
  private readonly logger = new Logger(FintavapayProvider.name);
  private readonly baseUrl: string;
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    const rawUrl = config
      .get<string>('FINTAVAPAY_BASE_URL', 'https://apifintavapay.com/api/dev')
      .trim()
      .replace(/\/+$/, '');

    // Normalize legacy hostname — docs say to use apifintavapay.com
    this.baseUrl = rawUrl.replace(
      /^https?:\/\/dev\.fintavapay\.com(\/.*)?$/i,
      (_match, path) => `https://apifintavapay.com${path ?? '/api/dev'}`,
    );

    this.secretKey = config.get<string>('FINTAVAPAY_SECRET_KEY', '');
    this.webhookSecret = config.get<string>('FINTAVAPAY_WEBHOOK_SECRET', '');
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  private get axiosConfig() {
    return {
      headers: this.headers,
      timeout: REQUEST_TIMEOUT_MS,
      httpAgent: IPV4_HTTP_AGENT,
      httpsAgent: IPV4_HTTPS_AGENT,
    };
  }

  /** Convert Kobo (BigInt) → Naira float for outbound API requests. */
  private koboToNaira(kobo: bigint): number {
    return Number(kobo) / 100;
  }

  /** Convert Naira float → Kobo BigInt for internal storage (verifyPayment responses). */
  private nairaToKobo(naira: number): bigint {
    return BigInt(Math.round(naira * 100));
  }

  /**
   * Initiates wallet funding.
   *
   * NOTE: FintavaPay uses static per-customer NUBANs, not per-transaction virtual
   * accounts. This method calls POST /create/customer to provision a NUBAN for the
   * user on first use. The NUBAN is returned as the virtualAccount; subsequent
   * calls for the same user should skip the API call and return the stored NUBAN
   * directly (handled at the wallet service layer via fintavaNuban on the User).
   *
   * Until the wallet service is updated to pass the existingNuban, this method
   * calls /create/customer on every initiation. FintavaPay returns 409 for
   * existing customers — we parse the NUBAN from the 409 body when available.
   */
  async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResult> {
    const expiresAt = new Date(Date.now() + (input.expireTimeInMin ?? 30) * 60 * 1000);

    // If the caller already resolved a stored NUBAN, skip the API call entirely.
    const existingNuban = (input.metadata as Record<string, unknown> | undefined)?.['fintavaNuban'] as string | undefined;
    if (existingNuban) {
      return {
        reference: input.reference,
        gatewayRef: existingNuban,
        paymentUrl: undefined,
        virtualAccount: {
          accountNumber: existingNuban,
          bankName: 'Loma Bank',
          expiresAt,
        },
      };
    }

    // No stored NUBAN — call /create/customer to provision one.
    const nameParts = (input.customerName ?? input.email).split(' ');
    const firstName = nameParts[0] ?? input.email;
    const lastName  = nameParts.slice(1).join(' ') || firstName;

    const payload: Record<string, unknown> = {
      firstName,
      lastName,
      email: input.email,
      phoneNumber: (input.phone ?? '').replace(/^\+234/, '0'),
      fundingMethod: 'STATIC_FUND',
      // BVN + dateOfBirth are required by Fintava for NIBSS verification.
      // Pass them via input.metadata when available.
      ...((input.metadata as Record<string, unknown> | undefined)?.['bvn']
        ? { bvn: (input.metadata as Record<string, unknown>)['bvn'] }
        : {}),
      ...((input.metadata as Record<string, unknown> | undefined)?.['dateOfBirth']
        ? { dateOfBirth: (input.metadata as Record<string, unknown>)['dateOfBirth'] }
        : {}),
      ...((input.metadata as Record<string, unknown> | undefined)?.['nin']
        ? { nin: (input.metadata as Record<string, unknown>)['nin'] }
        : {}),
      // address/state/lga default to placeholder if not provided
      address: (input.metadata as Record<string, unknown> | undefined)?.['address'] as string ?? 'Nigeria',
      state:   (input.metadata as Record<string, unknown> | undefined)?.['state'] as string ?? 'Lagos',
      lga:     (input.metadata as Record<string, unknown> | undefined)?.['lga'] as string ?? 'Lagos',
    };

    let accountNumber = '';

    try {
      const response = await axios.post(
        `${this.baseUrl}/create/customer`,
        payload,
        this.axiosConfig,
      );

      const raw  = response.data as Record<string, unknown>;
      const data = (raw['data'] ?? raw) as Record<string, unknown>;
      const userInfo = data['userInfo'] as Record<string, unknown> | undefined;

      accountNumber =
        String(userInfo?.['walletId'] ?? data['accountNumber'] ?? data['nuban'] ?? '');
    } catch (err: unknown) {
      // 409 = customer already exists — try to extract NUBAN from body
      const axiosErr = err as { response?: { status?: number; data?: unknown } };
      if (axiosErr.response?.status === 409) {
        const body = axiosErr.response.data as Record<string, unknown> | undefined;
        const bodyData = (body?.['data'] ?? body) as Record<string, unknown> | undefined;
        const userInfo = bodyData?.['userInfo'] as Record<string, unknown> | undefined;
        const recovered =
          String(userInfo?.['walletId'] ?? bodyData?.['accountNumber'] ?? bodyData?.['nuban'] ?? '');
        if (recovered) {
          accountNumber = recovered;
          this.logger.log(`FintavaPay 409 — recovered existing NUBAN ${recovered} for ${input.email}`);
        } else {
          // No NUBAN in 409 body — it will arrive via dedicatedaccount.assign.success webhook
          this.logger.warn(
            `FintavaPay 409 for ${input.email} with no NUBAN in body. ` +
            `Awaiting dedicatedaccount.assign.success webhook to auto-link.`,
          );
          throw new Error(
            'Your Fintava wallet account already exists but the account number could not be retrieved. ' +
            'It will be linked automatically — please try again in a few minutes.',
          );
        }
      } else {
        throw err;
      }
    }

    if (!accountNumber) {
      throw new Error('FintavaPay did not return a virtual account number. Please try again.');
    }

    return {
      reference: input.reference,
      gatewayRef: accountNumber,
      paymentUrl: undefined,
      virtualAccount: {
        accountNumber,
        bankName: 'Loma Bank',
        expiresAt,
      },
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
    const success = status === 'success' || status === 'successful' || status === 'completed';

    // verifyPayment response amounts are in Naira (float) — convert to Kobo for storage.
    const rawAmount = data['amount'] as number | undefined;
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
        accountNumber: input.accountNumber,
        accountName:   input.accountName,
        sortCode:      input.bankCode,
        amount:        Math.floor(amountNaira), // Fintava rejects decimals
        CustomerReference: input.reference,
        narration:     input.narration,
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
      const response = await axios.get(`${this.baseUrl}/banks`, this.axiosConfig);

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

    // Fintava environments may send the HMAC digest as hex OR base64. Try both.
    const bodyStr     = rawBody.toString();
    const computedHex    = crypto.createHmac('sha512', this.webhookSecret).update(rawBody).digest('hex');
    const computedBase64 = crypto.createHmac('sha512', this.webhookSecret).update(rawBody).digest('base64');

    const signatureValid = this.safeSignatureEqual(signatureHeader, computedHex, 'hex') ||
                           this.safeSignatureEqual(signatureHeader, computedBase64, 'base64') ||
                           signatureHeader === computedHex ||
                           signatureHeader === computedBase64;

    if (!signatureValid) {
      this.logger.warn('FintavaPay webhook signature mismatch');
      return empty;
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(bodyStr) as Record<string, unknown>;
    } catch {
      this.logger.warn('FintavaPay webhook body is not valid JSON');
      return empty;
    }

    const event =
      (body['event'] as string | undefined) ??
      (body['type'] as string | undefined) ??
      '';

    const data = (body['data'] ?? {}) as Record<string, unknown>;

    const reference =
      (data['CustomerReference'] as string | undefined) ??
      (data['customerReference'] as string | undefined) ??
      (data['merchantReference'] as string | undefined) ??
      (data['reference'] as string | undefined) ??
      '';

    // IMPORTANT: Webhook payload amounts are in KOBO (not Naira).
    // e.g. amount: 500000 = ₦5,000. Store directly as BigInt without conversion.
    const rawAmount = data['amount'] as number | undefined;
    const amountKobo = rawAmount !== undefined ? BigInt(Math.floor(rawAmount)) : 0n;

    const gatewayRef =
      (data['id'] as string | undefined) ??
      (data['transactionId'] as string | undefined) ??
      '';

    return { isValid: true, event, reference, amountKobo, gatewayRef };
  }

  /** Timing-safe buffer comparison for HMAC signatures. Returns false on any error. */
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
