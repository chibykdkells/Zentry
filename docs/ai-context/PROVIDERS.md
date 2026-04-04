# PROVIDERS.md — Provider Abstraction Layer (PAL)

> Last updated: 2026-04-03
> This is the most critical architectural pattern in Zentry.
> Every external API (payment, VTU, SMS, email, storage) sits behind
> a provider interface. Business logic NEVER calls external APIs directly.

---

## Why the PAL Exists

Zentry must be able to switch providers — payment gateways, VTU providers,
SMS vendors — with zero impact on business logic. A provider change should
require only:

1. Writing a new adapter class that implements the provider interface
2. Registering it in the provider module
3. Changing one environment variable

No changes to services, controllers, or business logic. Ever.

---

## PAL Structure

```
apps/api/src/providers/
├── interfaces/
│   ├── payment-provider.interface.ts    # IPaymentProvider
│   ├── vtu-provider.interface.ts        # IVtuProvider
│   ├── sms-provider.interface.ts        # ISmsProvider
│   ├── email-provider.interface.ts      # IEmailProvider
│   └── storage-provider.interface.ts    # IStorageProvider
│
├── payment/
│   ├── payment.module.ts
│   ├── payment.service.ts               # Delegates to active adapter
│   ├── fintavapay.adapter.ts            # Implements IPaymentProvider
│   ├── paystack.adapter.ts              # Implements IPaymentProvider
│   └── flutterwave.adapter.ts           # Implements IPaymentProvider
│
├── vtu/
│   ├── vtu.module.ts
│   ├── vtu.service.ts                   # Delegates to active adapter
│   └── vtuprovider-one.adapter.ts       # Implements IVtuProvider
│
├── sms/
│   ├── sms.module.ts
│   ├── sms.service.ts
│   └── termii.adapter.ts                # Implements ISmsProvider
│
├── email/
│   ├── email.module.ts
│   ├── email.service.ts
│   └── resend.adapter.ts                # Implements IEmailProvider
│
└── storage/
    ├── storage.module.ts
    ├── storage.service.ts
    └── cloudinary.adapter.ts            # Implements IStorageProvider
```

---

## IPaymentProvider Interface

```typescript
// providers/interfaces/payment-provider.interface.ts

export interface InitiatePaymentInput {
  amountKobo: bigint;
  email: string;
  reference: string;       // Platform-generated, unique
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

export interface InitiatePaymentResult {
  authorizationUrl: string;
  reference: string;
}

export interface VerifyPaymentResult {
  success: boolean;
  reference: string;
  gatewayRef: string;
  amountKobo: bigint;
  currency: string;
  paidAt: Date;
  rawResponse: unknown;
}

export interface IPaymentProvider {
  readonly providerName: string;
  initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
  verifyPayment(reference: string): Promise<VerifyPaymentResult>;
  verifyWebhookSignature(payload: string | Buffer, signature: string): boolean;
}
```

## IVtuProvider Interface

```typescript
// providers/interfaces/vtu-provider.interface.ts

export interface AirtimePurchaseInput {
  phone: string;
  amountKobo: bigint;
  network: 'MTN' | 'GLO' | 'AIRTEL' | '9MOBILE';
  reference: string;
}

export interface DataPurchaseInput {
  phone: string;
  planCode: string;
  network: string;
  reference: string;
}

export interface CableTvSubscribeInput {
  smartCardNumber: string;
  planCode: string;
  provider: 'DSTV' | 'GOTV' | 'STARTIMES';
  reference: string;
}

export interface ElectricityPayInput {
  meterNumber: string;
  amountKobo: bigint;
  meterType: 'PREPAID' | 'POSTPAID';
  disco: string;
  reference: string;
}

export interface VtuResult {
  success: boolean;
  reference: string;
  providerRef: string;
  token?: string;         // for electricity (recharge token)
  deliveredTo?: string;   // phone or meter number
  rawResponse: unknown;
}

export interface DataPlan {
  code: string;
  name: string;
  amountKobo: bigint;
  validity: string;
}

export interface IVtuProvider {
  readonly providerName: string;
  purchaseAirtime(input: AirtimePurchaseInput): Promise<VtuResult>;
  purchaseData(input: DataPurchaseInput): Promise<VtuResult>;
  subscribeCableTv(input: CableTvSubscribeInput): Promise<VtuResult>;
  payElectricity(input: ElectricityPayInput): Promise<VtuResult>;
  getDataPlans(network: string): Promise<DataPlan[]>;
  verifySmartCard(number: string, provider: string): Promise<unknown>;
  verifyMeter(number: string, disco: string): Promise<unknown>;
}
```

## ISmsProvider Interface

```typescript
// providers/interfaces/sms-provider.interface.ts

export interface SendSmsInput {
  to: string;         // Nigerian phone, format: +234XXXXXXXXXX
  message: string;
  senderId?: string;
}

export interface SendOtpInput {
  to: string;
  otp: string;
  expiryMinutes: number;
}

export interface ISmsProvider {
  readonly providerName: string;
  sendSms(input: SendSmsInput): Promise<{ messageId: string }>;
  sendOtp(input: SendOtpInput): Promise<{ messageId: string }>;
}
```

## IEmailProvider Interface

```typescript
// providers/interfaces/email-provider.interface.ts

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface IEmailProvider {
  readonly providerName: string;
  sendEmail(input: SendEmailInput): Promise<{ messageId: string }>;
}
```

## IStorageProvider Interface

```typescript
// providers/interfaces/storage-provider.interface.ts

export interface UploadFileInput {
  file: Buffer | string;      // Buffer or base64
  filename: string;           // Platform-generated name
  folder: string;             // e.g. 'orders/docs', 'orders/results', 'cbt/licenses'
  mimeType: string;
}

export interface UploadFileResult {
  publicId: string;
  secureUrl: string;          // Signed, time-limited URL
  format: string;
  sizeBytes: number;
}

export interface IStorageProvider {
  readonly providerName: string;
  uploadFile(input: UploadFileInput): Promise<UploadFileResult>;
  getSignedUrl(publicId: string, expirySeconds?: number): Promise<string>;
  deleteFile(publicId: string): Promise<void>;
}
```

---

## PaymentService — How Delegation Works

```typescript
// providers/payment/payment.service.ts

@Injectable()
export class PaymentService {
  private readonly activeProvider: IPaymentProvider;

  constructor(
    private readonly fintavapay: FintavapayAdapter,
    private readonly paystack: PaystackAdapter,
    private readonly flutterwave: FlutterwaveAdapter,
    private readonly configService: ConfigService,
  ) {
    const active = configService.get<string>('ACTIVE_PAYMENT_PROVIDER');
    const providers: Record<string, IPaymentProvider> = {
      FINTAVAPAY: fintavapay,
      PAYSTACK: paystack,
      FLUTTERWAVE: flutterwave,
    };
    this.activeProvider = providers[active];
    if (!this.activeProvider) {
      throw new Error(`Unknown payment provider: ${active}`);
    }
  }

  // Delegates all calls to the active provider
  initiatePayment(input: InitiatePaymentInput) {
    return this.activeProvider.initiatePayment(input);
  }

  verifyPayment(reference: string) {
    return this.activeProvider.verifyPayment(reference);
  }

  verifyWebhookSignature(payload: string | Buffer, signature: string) {
    return this.activeProvider.verifyWebhookSignature(payload, signature);
  }
}
```

Business logic calls `PaymentService` — never `FintavapayAdapter` directly.

---

## How to Add a New Provider

1. Create a new adapter file: `providers/payment/newgateway.adapter.ts`
2. Implement the `IPaymentProvider` interface fully
3. Decorate with `@Injectable()`
4. Register in `PaymentModule` providers array
5. Add the new key to the providers map in `PaymentService` constructor
6. Add env vars to `.env.example`
7. Set `ACTIVE_PAYMENT_PROVIDER=NEWGATEWAY` in `.env`
8. Done. Zero changes to wallet, orders, or any business logic.

---

## Commission Calculation on Provider Costs

For VTU services, the pricing model is:

```
Service.providerCost  = what VTU provider charges us (stored in DB, in KOBO)
Service.platformFee   = our markup (stored in DB, in KOBO)
Service.totalPrice    = providerCost + platformFee (what user pays)
```

When provider pricing changes:
1. Admin updates `service.providerCost` in admin panel
2. System auto-recalculates `totalPrice = providerCost + platformFee`
3. All future orders use the new price
4. Historical orders are unaffected (price snapshotted at order creation)

The adapter itself should NOT apply commission — it returns raw provider
cost. The service layer computes the user-facing price from DB config.

---

## Currently Configured Providers

| Type | Active | Backup 1 | Backup 2 |
|---|---|---|---|
| Payment | FintavaPay | Paystack | Flutterwave |
| VTU | TBD (plug in at Phase 7) | — | — |
| SMS | Termii | — | — |
| Email | Resend | — | — |
| Storage | Cloudinary | — | — |

Update this table when providers are changed or added.

---

## Webhook Handling Pattern

All payment gateways send webhooks. Handle them uniformly:

```
POST /webhooks/payment/:gateway

1. Read raw body (NOT parsed — needed for HMAC verification)
2. Call paymentService.verifyWebhookSignature(rawBody, signature header)
3. If invalid signature → return 403, log attempt
4. Parse event type from payload
5. Check idempotency: does Transaction with this gatewayRef exist?
   - YES → return 200 (already processed)
   - NO → process the event
6. Process event atomically (lock wallet, create Transaction, update Order)
7. Return 200 quickly — do heavy work in Bull queue if needed
```

Never process webhooks synchronously if they require multiple DB writes.
Queue them with Bull and process asynchronously.
