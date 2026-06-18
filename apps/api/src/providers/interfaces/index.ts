// ─────────────────────────────────────────────────────────────────────────────
// Provider Abstraction Layer (PAL)
// All money values are in Kobo (BigInt) — never Naira floats.
// ─────────────────────────────────────────────────────────────────────────────

export interface InitiatePaymentInput {
  /** Amount in Kobo */
  amountKobo: bigint;
  email: string;
  /** Customer full name — required by virtual-account gateways (e.g. FintavaPay) */
  customerName?: string;
  /** Customer phone — required by virtual-account gateways (e.g. FintavaPay) */
  phone?: string;
  /** Internal unique reference (ZDX-TXN-...) */
  reference: string;
  /** Where gateway should redirect the user after payment (redirect-based gateways only) */
  callbackUrl?: string;
  /** How long the payment session should remain valid (minutes) — virtual-account gateways */
  expireTimeInMin?: number;
  metadata?: Record<string, unknown>;
}

export interface VirtualAccountDetails {
  accountNumber: string;
  bankName: string;
  /** When the virtual account expires */
  expiresAt: Date;
}

export interface InitiatePaymentResult {
  /**
   * URL to redirect the user to for payment.
   * Undefined for virtual-account gateways (e.g. FintavaPay) — use virtualAccount instead.
   */
  paymentUrl?: string;
  /** Our internal reference */
  reference: string;
  /** Gateway's own session/access identifier */
  gatewayRef: string;
  /** Indicates whether the provider returned a live or development checkout */
  mode?: 'live' | 'sandbox';
  /**
   * Populated by virtual-account gateways (e.g. FintavaPay).
   * Show these details to the user so they can make a bank transfer.
   */
  virtualAccount?: VirtualAccountDetails;
}

export interface VerifyPaymentResult {
  success: boolean;
  /** Amount in Kobo as returned by gateway */
  amountKobo: bigint;
  reference: string;
  gatewayRef: string;
  paidAt?: Date;
  feeKobo?: bigint;
}

export interface WebhookParseResult {
  /** false → reject immediately, do not process */
  isValid: boolean;
  event: string;
  reference: string;
  /** Amount in Kobo */
  amountKobo: bigint;
  gatewayRef: string;
  feeKobo?: bigint;
}

export interface InitiateTransferInput {
  /** Amount in Kobo */
  amountKobo: bigint;
  accountNumber: string;
  bankCode: string;
  accountName: string;
  /** Internal unique reference (ZDX-WDR-...) */
  reference: string;
  narration: string;
}

export interface InitiateTransferResult {
  /** Our internal reference */
  transferRef: string;
  /** Gateway's own transfer identifier */
  gatewayRef: string;
  /** PENDING = gateway accepted but not yet settled, SUCCESS = immediately settled */
  status: 'PENDING' | 'SUCCESS';
}

export interface BankListItem {
  code: string;
  name: string;
}

export interface IPaymentProvider {
  /** Human-readable name matching PaymentGateway enum value */
  readonly gatewayName: string;
  initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
  verifyPayment(reference: string): Promise<VerifyPaymentResult>;
  /** Verify HMAC/hash signature and parse webhook body — synchronous */
  parseWebhook(rawBody: Buffer, signatureHeader: string): WebhookParseResult;
  /** Initiate a bank transfer payout. Throws on gateway error. */
  initiateTransfer(
    input: InitiateTransferInput,
  ): Promise<InitiateTransferResult>;
  /** Returns list of supported banks for recipient account resolution. */
  getBanks(): Promise<BankListItem[]>;
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';

export interface AirtimePurchaseInput {
  phone: string;
  network: string;
  amountKobo: bigint;
  reference: string;
  tenantId?: string | null;
}

export interface DataPurchaseInput {
  phone: string;
  planCode: string;
  amountKobo: bigint;
  reference: string;
  tenantId?: string | null;
}

export interface VtuDataPlan {
  code: string;
  name: string;
  amountKobo: bigint;
  validity: string;
}

export interface CablePlan {
  code: string;
  name: string;
  amountKobo: bigint;
  duration: string;
}

export interface VerifyCableSmartcardInput {
  provider: string;
  smartcardNumber: string;
  tenantId?: string | null;
}

export interface VerifyCableSmartcardResult {
  success: boolean;
  provider: string;
  smartcardNumber: string;
  customerName: string;
  currentPlan?: string;
  dueDate?: string;
  status: 'VALID' | 'INVALID';
}

export interface CablePurchaseInput {
  provider: string;
  smartcardNumber: string;
  planCode: string;
  amountKobo: bigint;
  reference: string;
  tenantId?: string | null;
}

export interface VerifyElectricityMeterInput {
  disco: string;
  meterNumber: string;
  meterType: 'PREPAID' | 'POSTPAID';
  tenantId?: string | null;
}

export interface VerifyElectricityMeterResult {
  success: boolean;
  disco: string;
  meterNumber: string;
  meterType: 'PREPAID' | 'POSTPAID';
  customerName: string;
  address?: string;
  status: 'VALID' | 'INVALID';
}

export interface ElectricityPurchaseInput {
  disco: string;
  meterNumber: string;
  meterType: 'PREPAID' | 'POSTPAID';
  amountKobo: bigint;
  reference: string;
  tenantId?: string | null;
}

export interface VtuScopeInput {
  tenantId?: string | null;
}

export interface VtuPurchaseResult {
  success: boolean;
  reference: string;
  providerReference: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  metadata?: Record<string, unknown>;
}

export interface VtuProviderReadiness {
  providerName: string;
  mode: 'live' | 'mock';
  resolvedScope: {
    type: 'PLATFORM' | 'TENANT';
    key: string;
  };
  configured: boolean;
  supportsLiveTransport: boolean;
  missingConfig: string[];
  endpoints: {
    health?: string | null;
    airtime: string;
    dataPurchase: string;
    dataPlans: string;
    cablePlans: string;
    cableVerify: string;
    cablePurchase: string;
    electricityVerify: string;
    electricityPurchase: string;
  };
  probe: {
    attempted: boolean;
    status: 'not_applicable' | 'healthy' | 'unreachable' | 'error';
    message: string;
    checkedAt: string;
  };
}

export interface IVtuProvider {
  readonly providerName: string;
  readonly providerMode: 'live' | 'mock';
  getReadiness(input?: VtuScopeInput): Promise<VtuProviderReadiness>;
  purchaseAirtime(input: AirtimePurchaseInput): Promise<VtuPurchaseResult>;
  purchaseData(input: DataPurchaseInput): Promise<VtuPurchaseResult>;
  getDataPlans(
    network: string,
    tenantId?: string | null,
  ): Promise<VtuDataPlan[]>;
  getCablePlans(
    provider: string,
    tenantId?: string | null,
  ): Promise<CablePlan[]>;
  verifyCableSmartcard(
    input: VerifyCableSmartcardInput,
  ): Promise<VerifyCableSmartcardResult>;
  purchaseCable(input: CablePurchaseInput): Promise<VtuPurchaseResult>;
  verifyElectricityMeter(
    input: VerifyElectricityMeterInput,
  ): Promise<VerifyElectricityMeterResult>;
  purchaseElectricity(
    input: ElectricityPurchaseInput,
  ): Promise<VtuPurchaseResult>;
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
  errorMessage?: string;
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
  /** Generate a time-limited signed delivery URL for a private file. */
  getSignedUrl(publicId: string, expiresInSeconds: number): string;
  /** Like getSignedUrl but forces the browser to download the file (Content-Disposition: attachment). */
  getSignedDownloadUrl(publicId: string, expiresInSeconds: number): string;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
