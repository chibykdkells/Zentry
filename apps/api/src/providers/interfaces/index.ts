// ─────────────────────────────────────────────────────────────────────────────
// Provider Abstraction Layer (PAL)
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
  /** Indicates whether the provider returned a live or development checkout */
  mode?: 'live' | 'sandbox';
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

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';

export interface AirtimePurchaseInput {
  phone: string;
  network: string;
  amountKobo: bigint;
  reference: string;
}

export interface DataPurchaseInput {
  phone: string;
  planCode: string;
  amountKobo: bigint;
  reference: string;
}

export interface VtuPurchaseResult {
  success: boolean;
  reference: string;
  providerReference: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
}

export interface IVtuProvider {
  readonly providerName: string;
  purchaseAirtime(input: AirtimePurchaseInput): Promise<VtuPurchaseResult>;
  purchaseData(input: DataPurchaseInput): Promise<VtuPurchaseResult>;
}

export const VTU_PROVIDER = 'VTU_PROVIDER';

export interface SendSmsInput {
  to: string;
  message: string;
  senderId?: string;
}

export interface SendSmsResult {
  messageId: string;
  status: 'QUEUED' | 'SENT' | 'FAILED';
}

export interface ISmsProvider {
  readonly providerName: string;
  sendSms(input: SendSmsInput): Promise<SendSmsResult>;
}

export const SMS_PROVIDER = 'SMS_PROVIDER';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromEmail?: string;
  fromName?: string;
}

export interface SendEmailResult {
  messageId: string;
  accepted: boolean;
}

export interface IEmailProvider {
  readonly providerName: string;
  sendEmail(input: SendEmailInput): Promise<SendEmailResult>;
}

export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';

export interface UploadFileInput {
  filename: string;
  mimeType: string;
  data: Buffer;
  folder: string;
}

export interface UploadFileResult {
  url: string;
  publicId: string;
}

export interface IStorageProvider {
  readonly providerName: string;
  uploadFile(input: UploadFileInput): Promise<UploadFileResult>;
  deleteFile(publicId: string): Promise<void>;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
