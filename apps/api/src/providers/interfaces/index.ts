// ─────────────────────────────────────────────────────────────────────────────
// Provider Abstraction Layer (PAL) — Payment Interface
// All money values are in Kobo (BigInt) — never Naira floats.
// ─────────────────────────────────────────────────────────────────────────────

export interface InitiatePaymentInput {
  /** Amount in Kobo */
  amountKobo: bigint;
  email: string;
  /** Internal unique reference (ZEN-TXN-...) */
  reference: string;
  /** Where gateway should redirect the user after payment */
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

export interface InitiatePaymentResult {
  /** URL to redirect the user to for payment */
  paymentUrl: string;
  /** Our internal reference */
  reference: string;
  /** Gateway's own session/access identifier */
  gatewayRef: string;
}

export interface VerifyPaymentResult {
  success: boolean;
  /** Amount in Kobo as returned by gateway */
  amountKobo: bigint;
  reference: string;
  gatewayRef: string;
  paidAt?: Date;
}

export interface WebhookParseResult {
  /** false → reject immediately, do not process */
  isValid: boolean;
  event: string;
  reference: string;
  /** Amount in Kobo */
  amountKobo: bigint;
  gatewayRef: string;
}

export interface IPaymentProvider {
  /** Human-readable name matching PaymentGateway enum value */
  readonly gatewayName: string;
  initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
  verifyPayment(reference: string): Promise<VerifyPaymentResult>;
  /** Verify HMAC/hash signature and parse webhook body — synchronous */
  parseWebhook(rawBody: Buffer, signatureHeader: string): WebhookParseResult;
}

// Injection token
export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';
