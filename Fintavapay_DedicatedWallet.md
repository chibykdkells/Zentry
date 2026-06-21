# Fintava BaaS Integration Guide

Complete integration reference for **wallet activation**, **wallet-to-wallet transfers**, **wallet-to-bank transfers**, and **merchant-to-bank transfers** using the Fintava API. This document incorporates all production discoveries and is self-contained for use in a new project.

---

## Table of Contents

1. [Overview](#overview)
2. [Environments & Base URLs](#environments--base-urls)
3. [Authentication](#authentication)
4. [Amount Units](#amount-units)
5. [Flow 1 — Wallet Activation (Create Customer)](#flow-1--wallet-activation-create-customer)
6. [Flow 2 — Wallet-to-Wallet Transfer](#flow-2--wallet-to-wallet-transfer)
7. [Flow 3 — Customer Wallet-to-Bank Transfer](#flow-3--customer-wallet-to-bank-transfer)
8. [Flow 4 — Merchant Wallet-to-Bank Transfer](#flow-4--merchant-wallet-to-bank-transfer)
9. [Supporting Endpoints](#supporting-endpoints)
10. [Webhooks](#webhooks)
11. [TypeScript Reference Implementation](#typescript-reference-implementation)
12. [Production Infrastructure Notes](#production-infrastructure-notes)
13. [Critical Gotchas](#critical-gotchas)
14. [Error Reference](#error-reference)

---

## Overview

Fintava is a Nigerian BaaS (Banking-as-a-Service) provider. Each customer registered under your merchant account receives a **Loma Bank virtual account** (sort code `090620`). There are two distinct transfer pools:

```
External bank  ←──────────────────────────────────────────────────┐
                                                                   │
Fintava customer wallet  ──[/bank/credit]──────────────────────► NIP
        ↕  /transaction/wallet-to-wallet
Fintava customer wallet  ──[/bank/credit]──────────────────────► NIP

Merchant wallet  ──────[/bank/credit/merchant]─────────────────► NIP
```

- **Customer wallet** (`/bank/credit`): funded from individual user NUBAN inflows. Requires `sourceId` (user's Fintava UUID). Used for agent/coordinator withdrawals.
- **Merchant wallet** (`/bank/credit/merchant`): the merchant's own Fintava account. No `sourceId` needed. Used for platform-level payouts — e.g. collecting withdrawal fees and sending platform disbursements.

The merchant balance shown on the Fintava dashboard is **not** a sum of customer wallets. It is a separate spendable pool — typically small unless you have explicitly funded it or collected fees into it via merchant transfers.

---

## Environments & Base URLs

> **Production discovery:** `dev.fintavapay.com` is a legacy hostname that redirects to the same infrastructure. Normalize it to `apifintavapay.com` to avoid DNS inconsistencies.

| Environment | Base URL |
|---|---|
| Sandbox | `https://apifintavapay.com/api/dev` |
| Live | `https://apifintavapay.com/api/dev` |

Both sandbox and live use the same base URL. The environment is determined by which **API key** you provide — use the sandbox key for testing and the live key for production.

```
FINTAVA_BASE_URL=https://apifintavapay.com/api/dev
FINTAVA_API_KEY=<your merchant API key>
FINTAVA_WEBHOOK_SECRET=<your webhook secret>
```

If your environment variable still holds `https://dev.fintavapay.com/api/dev`, normalize it on startup:

```typescript
function normalizeFintavaBaseUrl(baseUrl?: string): string {
  const trimmed = (baseUrl ?? 'https://apifintavapay.com/api/dev').trim().replace(/\/+$/, '');
  return trimmed.replace(
    /^https:\/\/dev\.fintavapay\.com\/api\/dev$/i,
    'https://apifintavapay.com/api/dev',
  );
}
```

---

## Authentication

All requests must include the API key as a **Bearer token** in the Authorization header.

```http
Authorization: Bearer <your merchant API key>
Content-Type: application/json
Accept: application/json
```

> **Pitfall 1:** The official Fintava documentation omits the `Bearer` prefix. Sending `Authorization: <key>` (without Bearer) results in `401 Unauthorized` or `invalid api key`.

> **Pitfall 2:** Some HTTP clients have an "Authorization" section under Params — that sends the value as a query string, which Fintava rejects. Always use the Headers section.

---

## Amount Units

| Context | Unit | Example |
|---|---|---|
| All request bodies (outbound) | Whole naira | `amount: 5000` = ₦5,000 |
| Webhook event payloads (inbound) | Kobo | `amount: 500000` = ₦5,000 |
| `GET /customer/wallet/balance` response | Whole naira | `availableBalance: 5000` = ₦5,000 |

Always divide incoming webhook amounts by `100` before storing or displaying. Always floor outbound amounts to whole naira — Fintava rejects decimal amounts.

---

## Flow 1 — Wallet Activation (Create Customer)

Creates a Fintava customer record and provisions a **static** Loma Bank virtual account (NUBAN) for that customer.

### Endpoint

```
POST /create/customer
```

> **Production discovery:** The Fintava documentation lists this as `POST /customers`. The actual working endpoint is `POST /create/customer`. Using `/customers` returns 404.

### Request Body

```json
{
  "firstName": "Yusuf",
  "lastName": "Ibrahim",
  "email": "yusuf@example.com",
  "phoneNumber": "08012345678",
  "bvn": "22345678901",
  "nin": "12345678901",
  "dateOfBirth": "1990-01-15",
  "address": "12 Lagos Street",
  "state": "Lagos",
  "lga": "Ikeja",
  "fundingMethod": "STATIC_FUND"
}
```

**Field constraints:**

| Field | Notes |
|---|---|
| `fundingMethod` | **Required.** Must be `"STATIC_FUND"` to issue a static (permanent) virtual account. Without this field, Fintava does not provision a dedicated NUBAN. |
| `dateOfBirth` | `YYYY-MM-DD` format. **Field name is `dateOfBirth`, not `dob`.** Must match the BVN record in NIBSS exactly. |
| `nin` | 11-digit string. **Omit the field entirely if unavailable — do not send `nin: ""`** (Fintava returns `"nin must be a number string"`). |
| `phoneNumber` | 11-digit Nigerian mobile. No `+234` prefix. |
| `bvn` | Must belong to the same person as `nin`. Mismatch returns HTTP 502 from NIBSS. |
| `email` | Must be globally unique across all Fintava merchants. A second registration attempt returns 409. |

### Successful Response (HTTP 200/201)

```json
{
  "status": "success",
  "data": {
    "id": "bbd951dd-6460-4a8d-8555-8ac1cd902747",
    "userInfo": {
      "id": "c57dc5f3-fc77-4035-87e3-0ab39bb285f8",
      "email": "yusuf@example.com",
      "walletId": "0058996637"
    },
    "accountNumber": "0058996637",
    "bankName": "Loma Bank",
    "bankCode": "090620"
  }
}
```

### CRITICAL: Which UUID to Store

The response contains **two different UUIDs**:

| Field | Example value | Use for |
|---|---|---|
| `data.id` (top-level) | `bbd951dd-...` | **Do not use as sourceId** |
| `data.userInfo.id` | `c57dc5f3-...` | **This is the `sourceId` for all `/bank/credit` transfers** |

**Always store `data.userInfo.id`.** Using `data.id` as `sourceId` causes Fintava to return HTTP 500 with no useful error.

```typescript
// Correct extraction
const userInfo    = response.data?.userInfo ?? {};
const customerId  = userInfo.id ?? response.data?.id ?? '';
//                  ^^^^^^^^^^^^  ← use this for sourceId

const accountNumber = userInfo.walletId ?? response.data?.accountNumber ?? '';

// Store both in your DB
await db.query(
  'UPDATE users SET fintava_customer_id = $1, fintava_nuban = $2 WHERE id = $3',
  [customerId, accountNumber, userId]
);
```

### Customer Already Exists (HTTP 409)

```json
{ "status": "409", "message": "TypeORMError: Customer with email or Phone exists" }
```

**Recovery strategy:**
1. Check if the error body contains `data.customerId` / `data.id` / `data.customer.id` — some Fintava environments return the existing customer data inside the 409 body. If present, extract and store it.
2. If the body has no IDs, wait for the `dedicatedaccount.assign.success` webhook — Fintava sends it when a duplicate activation is triggered on an account that already has a NUBAN assigned.
3. As a last resort, search the Fintava merchant dashboard for the user's email and link the account manually.

> **There is no customer lookup API.** Both `/fetch-customer` and `/get-customer-by-phone-number` return 404. The only programmatic recovery path is the webhook.

### Virtual Account Details

After successful creation, the customer has:

```
Bank:    Loma Bank
Code:    090620
NUBAN:   data.userInfo.walletId  (10 digits)
```

Store both `customerId` (userInfo.id) and `accountNumber` (walletId) — you need both for different operations.

---

## Flow 2 — Wallet-to-Wallet Transfer

Moves funds between two Fintava customer wallets without leaving the Fintava network. No inter-bank fees apply.

### Endpoint

```
POST /transaction/wallet-to-wallet
```

> **Deprecated endpoint:** `POST /single/transfer` returns `{"status":"404","message":"Endpoint is deprecated!"}`. Do not use it.

### Request Body

```json
{
  "senderAccount": "0025240022",
  "receiverAccount": "0058996637",
  "amount": 5000,
  "CustomerReference": "DISB-2026-05-24-projectId-memberId",
  "narration": "Commission disbursement May 2026"
}
```

| Field | Type | Notes |
|---|---|---|
| `senderAccount` | string | Sender's Loma Bank NUBAN (10 digits) |
| `receiverAccount` | string | Receiver's Loma Bank NUBAN (10 digits) |
| `amount` | number | Whole naira — floor decimals before sending |
| `CustomerReference` | string | Your idempotency key. Keep under 50 chars. |
| `narration` | string | Appears on statement |

### Reference Convention

```
DISB-{projectId}-{memberId}-{yyyymmdd}
WD-{withdrawalId}-{timestamp}
```

### Successful Response (HTTP 200)

```json
{
  "status": "success",
  "message": "Transfer successful",
  "data": {
    "reference": "FNT-...",
    "customerReference": "DISB-...",
    "amount": 5000,
    "status": "success"
  }
}
```

### Common Errors

| Error | Cause |
|---|---|
| `"same customer not allowed"` | `senderAccount` and `receiverAccount` belong to the same Fintava customer |
| `"sourceId, accountNumber, sortCode required"` | `/bank/credit` field names sent to the wallet-to-wallet endpoint |

---

## Flow 3 — Customer Wallet-to-Bank Transfer

Sends funds from a **customer's Fintava wallet** to any Nigerian bank account via NIP/NIBSS. Used for agent and coordinator withdrawals.

### Endpoint

```
POST /bank/credit
```

### Request Body

```json
{
  "sourceId": "c57dc5f3-fc77-4035-87e3-0ab39bb285f8",
  "accountNumber": "0123456789",
  "accountName": "IBRAHIM YUSUF",
  "sortCode": "000013",
  "amount": 4850,
  "narration": "Commission withdrawal",
  "CustomerReference": "WD-abc123-1716547200"
}
```

| Field | Type | Notes |
|---|---|---|
| `sourceId` | UUID string | `userInfo.id` from customer creation — **NOT** top-level `id` |
| `accountNumber` | string | Beneficiary's 10-digit NUBAN |
| `accountName` | string | Beneficiary's name (recommended — aids NIP matching) |
| `sortCode` | string | Fintava 6-digit bank code (see Sort Codes section below) |
| `amount` | number | Whole naira |
| `narration` | string | Transaction description |
| `CustomerReference` | string | Your idempotency key |

### Sort Codes

> **Production discovery:** The `/bank/credit` and `/name/enquiry` endpoints require **Fintava 6-digit bank codes** (e.g. `000013`), not CBN 3-digit codes. User-submitted sort codes are typically CBN 3-digit (e.g. `058`). You must convert.

```typescript
const CBN_TO_FINTAVA_BANK_CODE: Record<string, string> = {
  '232': '000001',  // Sterling Bank (alt)
  '082': '000002',  // Keystone Bank
  '214': '000003',  // First City Monument Bank
  '033': '000004',  // United Bank for Africa
  '301': '000006',  // JAIZ Bank (alt)
  '070': '000007',  // Fidelity Bank
  '076': '000008',  // Polaris Bank
  '023': '000009',  // Citibank Nigeria
  '050': '000010',  // Ecobank Nigeria
  '215': '000011',  // Unity Bank
  '221': '000012',  // Stanbic IBTC
  '058': '000013',  // Guaranty Trust Bank
  '044': '000014',  // Access Bank
  '057': '000015',  // Zenith Bank
  '011': '000016',  // First Bank
  '035': '000017',  // Wema Bank
  '032': '000018',  // Union Bank
  '030': '000020',  // Heritage Bank
  '068': '000021',  // Standard Chartered
  '100': '000022',  // Providus Bank
  '101': '000023',  // Parallex Bank
  '102': '000025',  // Titan Trust Bank
  '302': '000026',  // Taj Bank
  '103': '000027',  // Globus Bank
  '303': '000029',  // Premium Trust Bank
  '526': '000030',  // Rand Merchant Bank
  '105': '000031',  // Lotus Bank
};

function toFintavaBankCode(sortCode: string): string {
  return CBN_TO_FINTAVA_BANK_CODE[sortCode.trim()] ?? sortCode.trim();
}
```

Pass the result of `toFintavaBankCode(userSortCode)` as `sortCode` in both `/bank/credit` and `/name/enquiry`. Codes already in 6-digit format pass through unchanged.

### Name Enquiry Before Transfer

Always verify the beneficiary account name before initiating a withdrawal:

```
GET /name/enquiry?accountNumber=0123456789&sortCode=000013
```

Response:

```json
{
  "status": "success",
  "data": {
    "accountName": "IBRAHIM YUSUF",
    "accountNumber": "0123456789",
    "bankCode": "000013"
  }
}
```

Display the returned `accountName` to the user for confirmation before sending funds.

### Successful Response

```json
{
  "status": "success",
  "message": "Transfer initiated",
  "data": {
    "reference": "FNT-...",
    "customerReference": "WD-abc123-1716547200",
    "status": "pending"
  }
}
```

Status is `pending` on the initial response. Final settlement arrives via the `customer_bank_transfer` webhook event.

---

## Flow 4 — Merchant Wallet-to-Bank Transfer

Sends funds from the **merchant's own Fintava wallet** to any Nigerian bank account. No `sourceId` required. Used for platform-level disbursements and payouts where the source is the platform, not an individual user wallet.

### Endpoint

```
POST /bank/credit/merchant
```

### Request Body

```json
{
  "accountNumber": "0123456789",
  "accountName": "IBRAHIM YUSUF",
  "sortCode": "000013",
  "amount": 4850,
  "narration": "Platform payout",
  "CustomerReference": "PLAT-WD-abc123-1716547200"
}
```

| Field | Type | Notes |
|---|---|---|
| `accountNumber` | string | Beneficiary's 10-digit NUBAN |
| `accountName` | string | Beneficiary's name |
| `sortCode` | string | Fintava 6-digit bank code (same mapping as Flow 3) |
| `amount` | number | Whole naira — deducted from the merchant wallet balance |
| `narration` | string | Transaction description |
| `CustomerReference` | string | Your idempotency key |

**Note:** No `sourceId` field. The merchant wallet is the implicit source. The merchant wallet must have sufficient balance — check with `GET /merchant/balance` before initiating if needed.

### Successful Response

Same shape as Flow 3. Status is `pending` initially; `customer_bank_transfer` webhook confirms settlement.

### When to Use Flow 4 vs Flow 3

| Scenario | Use |
|---|---|
| Agent withdrawing their commission to personal bank | Flow 3 (`/bank/credit`) |
| Coordinator withdrawing earned fees | Flow 3 (`/bank/credit`) |
| Platform paying out from its own collected revenue | Flow 4 (`/bank/credit/merchant`) |
| Platform collecting withdrawal fees → retaining in merchant wallet | Merchant wallet accumulates automatically via Loma Bank transfer logic |

> **Critical accounting note:** Never mix these two flows. They draw from separate pools. Flow 3 debits the individual user's Fintava wallet. Flow 4 debits the merchant wallet. Confusing them causes balance discrepancies that are hard to reconcile.

---

## Supporting Endpoints

### Bank List

```
GET /banks
```

Returns all supported Nigerian banks. Response codes are 6-digit Fintava/NIP codes. Use `CBN_TO_FINTAVA_BANK_CODE` to map user-supplied CBN codes (3-digit) before any transfer.

### Customer Wallet Balance

```
GET /customer/wallet/balance/{nuban}
```

`nuban` is the 10-digit account number (same as `userInfo.walletId`). Returns balance in **whole naira**.

```json
{
  "status": "success",
  "data": {
    "availableBalance": 49500,
    "ledgerBalance": 49500,
    "currency": "NGN"
  }
}
```

### Merchant Balance

```
GET /merchant/balance
```

Returns the merchant's own spendable wallet balance (not the sum of customer wallets).

### Customer List

```
GET /customers/list
```

Lists all customers registered under your merchant account. Response shape varies — inspect live to confirm field names. Useful for manual reconciliation; do not rely on it programmatically as a lookup (no filter by email parameter).

---

## Webhooks

Fintava sends POST requests to your configured webhook URL when key events occur.

### Configuration

Set your webhook endpoint in the Fintava merchant dashboard:

```
https://your-api.example.com/webhooks/fintava
```

Ensure the endpoint receives the **raw request body** (before JSON parsing) — this is required for HMAC signature verification.

### Signature Verification

Every webhook includes an `x-fintava-signature` header. **Verify it before processing any event.**

> **Production discovery:** Fintava environments may send the HMAC digest as either **hex** or **base64**. Always try both.

```typescript
import * as crypto from 'crypto';

function verifyFintavaSignature(rawBody: string, signature: string, secret: string): boolean {
  try {
    const computedHex    = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
    const computedBase64 = crypto.createHmac('sha512', secret).update(rawBody).digest('base64');

    // Try hex comparison (standard)
    try {
      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(computedHex, 'hex');
      if (sigBuf.length > 0 && sigBuf.length === expBuf.length) {
        if (crypto.timingSafeEqual(expBuf, sigBuf)) return true;
      }
    } catch { /* ignore */ }

    // Try base64 comparison (some Fintava environments)
    try {
      const sigBuf = Buffer.from(signature, 'base64');
      const expBuf = Buffer.from(computedBase64, 'base64');
      if (sigBuf.length > 0 && sigBuf.length === expBuf.length) {
        if (crypto.timingSafeEqual(expBuf, sigBuf)) return true;
      }
    } catch { /* ignore */ }

    // Plain string comparison as last resort
    if (signature === computedHex || signature === computedBase64) return true;

    return false;
  } catch {
    return false;
  }
}
```

### Idempotency

Fintava may deliver the same event more than once. Always check `reference` before processing:

```typescript
const ref = event.data?.CustomerReference ?? event.data?.customerReference ?? event.data?.reference;
const existing = await db.query('SELECT id FROM transactions WHERE reference = $1', [ref]);
if (existing.rows.length > 0) return { received: true };
```

### Key Events

| Event | Trigger |
|---|---|
| `account_funded` | External bank transfer received into a customer virtual account |
| `wallet_to_wallet_transfer_v2` | Wallet-to-wallet transfer settled |
| `customer_bank_transfer` | Customer or merchant wallet-to-bank transfer settled |
| `debit_transfer_reversal` | A transfer was reversed by Fintava |
| `dedicatedaccount.assign.success` | Virtual NUBAN assigned to a customer — use this to recover NUBAN when `/create/customer` returned 409 |

> **`dedicatedaccount.assign.success`** fires when a static NUBAN is provisioned, including when triggered by a duplicate customer registration attempt. Handle it by looking up the user by email and saving the NUBAN if not already stored.

### Webhook Payload Shape

```json
{
  "event": "wallet_to_wallet_transfer_v2",
  "data": {
    "reference": "FNT-...",
    "customerReference": "YOUR-REF-001",
    "CustomerReference": "YOUR-REF-001",
    "amount": 500000,
    "status": "success",
    "narration": "...",
    "senderWalletId": "0025240022",
    "receiverWalletId": "0058996637"
  }
}
```

- `amount` is always in **kobo** in webhook payloads — divide by 100.
- Both `customerReference` (lowercase) and `CustomerReference` (uppercase) may appear. Check both.

```typescript
const amountNaira = Math.floor((event.data?.amount ?? 0) / 100);
const ref = event.data?.CustomerReference ?? event.data?.customerReference ?? event.data?.reference;
```

---

## TypeScript Reference Implementation

### Service Interface

```typescript
export interface IFintavaService {
  createCustomer(input: FintavaCreateCustomerInput): Promise<FintavaCreateCustomerResult>;
  walletToWallet(input: FintavaWalletToWalletInput): Promise<FintavaWalletToWalletResult>;
  transferToBank(input: FintavaTransferToBankInput): Promise<FintavaTransferToBankResult>;
  merchantTransferToBank(input: FintavaMerchantTransferToBankInput): Promise<FintavaTransferToBankResult>;
  nameEnquiry(accountNumber: string, sortCode: string): Promise<FintavaNameEnquiryResult>;
  getMerchantBalance(): Promise<FintavaMerchantBalanceResult>;
  getBankList(): Promise<FintavaBankListItem[]>;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
}
```

### DTOs

```typescript
export interface FintavaCreateCustomerInput {
  firstName:   string;
  lastName:    string;
  email:       string;
  phoneNumber: string;
  bvn:         string;
  nin?:        string;        // omit entirely if unavailable — do not send empty string
  dateOfBirth: string;        // YYYY-MM-DD  ← field name is dateOfBirth, not dob
  address:     string;
  state:       string;
  lga:         string;
  // fundingMethod is always 'STATIC_FUND' — injected by the service, not the caller
}

export interface FintavaCreateCustomerResult {
  customerId:    string;  // userInfo.id — use as sourceId for /bank/credit
  accountNumber: string;  // Loma Bank NUBAN (10 digits)
  accountName:   string;
}

export interface FintavaWalletToWalletInput {
  senderAccount:   string;   // sender NUBAN
  receiverAccount: string;   // receiver NUBAN
  amount:          number;   // whole naira
  reference:       string;   // your idempotency key → CustomerReference
  narration:       string;
}

export interface FintavaTransferToBankInput {
  sourceId:      string;   // userInfo.id from createCustomer
  accountNumber: string;
  accountName:   string;
  sortCode:      string;   // CBN 3-digit — service converts to Fintava 6-digit internally
  amount:        number;   // whole naira
  narration?:    string;
  reference:     string;
}

export interface FintavaMerchantTransferToBankInput {
  accountNumber: string;
  accountName:   string;
  sortCode:      string;   // CBN 3-digit — service converts to Fintava 6-digit internally
  amount:        number;   // whole naira
  narration?:    string;
  reference:     string;
}

export interface FintavaNameEnquiryResult {
  accountName:   string;
  accountNumber: string;
  bankName?:     string;
}
```

### Core HTTP Helper

```typescript
import * as https from 'https';
import * as http from 'http';

function fintavaRequest<T>(
  method: 'GET' | 'POST',
  baseUrl: string,
  path: string,
  apiKey: string,
  body?: unknown,
): Promise<T> {
  // 5-second hard cap (see Production Infrastructure Notes)
  const TIMEOUT_MS = 5_000;

  const inner = new Promise<T>((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const url = new URL(path.replace(/^\/+/, ''), baseUrl.replace(/\/?$/, '/'));
    const isHttps = url.protocol === 'https:';
    const mod = isHttps ? https : http;

    const req = mod.request({
      hostname: url.hostname,
      port:     url.port || (isHttps ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      family:   4 as const,   // force IPv4 — required on Fly.io (see Infrastructure Notes)
      timeout:  8_000,
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept:         'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    }, (res) => {
      let raw = '';
      res.on('data', (chunk: Buffer) => { raw += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          const isError =
            parsed['status'] === false || parsed['status'] === 'false' ||
            parsed['status'] === 0 || parsed['status'] === 'failed' ||
            parsed['status'] === 'error' || parsed['success'] === false ||
            parsed['error'] === true;

          if (isError || (res.statusCode && res.statusCode >= 400)) {
            const msg = String(parsed['message'] ?? parsed['msg'] ?? `HTTP ${res.statusCode}`);
            reject(new Error(msg));
            return;
          }

          resolve((parsed['data'] ?? parsed) as T);
        } catch {
          reject(new Error(`Failed to parse Fintava response: ${raw.slice(0, 200)}`));
        }
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Fintava request timed out.')); });
    req.on('error', (err: Error) => { reject(err); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });

  const timer = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Wallet service unreachable. Try again in a few minutes.')), TIMEOUT_MS)
  );
  return Promise.race([inner, timer]);
}
```

### Customer Creation

```typescript
async createCustomer(input: FintavaCreateCustomerInput): Promise<FintavaCreateCustomerResult> {
  const payload: Record<string, unknown> = {
    firstName:     input.firstName,
    lastName:      input.lastName,
    email:         input.email,
    phoneNumber:   input.phoneNumber,
    bvn:           input.bvn,
    dateOfBirth:   input.dateOfBirth,   // not 'dob'
    address:       input.address,
    state:         input.state,
    lga:           input.lga,
    fundingMethod: 'STATIC_FUND',       // required for static NUBAN
  };
  if (input.nin?.trim()) payload['nin'] = input.nin.trim();

  let raw: Record<string, unknown>;
  try {
    raw = await fintavaRequest('POST', this.baseUrl, '/create/customer', this.apiKey, payload);
                                                     // ^^^^^^^^^^^^^^^^ not /customers
  } catch (err: unknown) {
    const msg = String((err as Error).message ?? '');
    if (/customer with email or phone exist/i.test(msg)) {
      // Try to extract data from 409 body if available, else return specific error
      throw new Error(
        `Fintava account already exists for ${input.email}. ` +
        `Wait for dedicatedaccount.assign.success webhook to auto-link the NUBAN.`
      );
    }
    throw err;
  }

  const userInfo = raw['userInfo'] as Record<string, unknown> | undefined;

  const customerId =
    String(userInfo?.['id'] ?? raw['customerId'] ?? raw['userId'] ?? raw['id'] ?? '');
  const accountNumber =
    String(userInfo?.['walletId'] ?? raw['accountNumber'] ?? raw['nuban'] ?? '');

  if (!accountNumber) throw new Error(`Fintava activation: no NUBAN in response. Keys: [${Object.keys(raw).join(', ')}]`);

  return { customerId, accountNumber, accountName: String(raw['accountName'] ?? '') };
}
```

### Webhook Handler (NestJS)

```typescript
import { Controller, Post, Req, Body, UnauthorizedException } from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';

@Controller('webhooks')
export class FintavaWebhookController {
  constructor(
    private readonly fintava: IFintavaService,
    private readonly walletUsecase: WalletUsecase,
  ) {}

  @Post('fintava')
  async handle(@Req() req: RawBodyRequest<Request>, @Body() body: Record<string, unknown>) {
    const sig = req.headers['x-fintava-signature'] as string;
    const rawBody = req.rawBody?.toString() ?? JSON.stringify(body);

    if (!this.fintava.verifyWebhookSignature(rawBody, sig)) {
      throw new UnauthorizedException('Invalid Fintava webhook signature');
    }

    const data = body['data'] as Record<string, unknown> | undefined;
    const ref = String(data?.['CustomerReference'] ?? data?.['customerReference'] ?? data?.['reference'] ?? '');

    // Idempotency: skip if already processed
    const exists = await this.txRepo.existsByReference(ref);
    if (exists) return { received: true };

    const amountNaira = Math.floor(Number(data?.['amount'] ?? 0) / 100); // kobo → naira

    switch (body['event']) {
      case 'account_funded':
        await this.walletUsecase.creditFromFintavaInbound(ref, amountNaira, data);
        break;
      case 'wallet_to_wallet_transfer_v2':
        await this.walletUsecase.settleWalletToWallet(ref, data);
        break;
      case 'customer_bank_transfer':
        await this.walletUsecase.settleWithdrawal(ref, data);
        break;
      case 'debit_transfer_reversal':
        await this.walletUsecase.reverseTransfer(ref, data);
        break;
      case 'dedicatedaccount.assign.success':
        // Auto-link NUBAN for customers where /create/customer returned 409
        await this.walletUsecase.saveFintavaNubanFromWebhook(data);
        break;
    }

    return { received: true };
  }
}
```

---

## Production Infrastructure Notes

### 1. Force IPv4 on Fly.io

Fintava's DNS resolution sometimes returns IPv6 addresses, which can hang indefinitely on Fly.io's Johannesburg region. Set `family: 4` in the Node.js `http.request` options to force IPv4:

```typescript
const options = {
  hostname: url.hostname,
  family:   4 as const,   // IPv4 only
  ...
};
```

Without this, wallet activation and transfer requests can silently hang for 30+ seconds before timing out.

### 2. 5-Second Hard Timeout

Mobile clients (iOS/Android) drop idle connections at approximately 8–10 seconds. Fintava itself can take 3–6 seconds for some operations. Use a hard cap of 5 seconds via `Promise.race`:

```typescript
const timer = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error('Wallet service unreachable.')), 5_000)
);
return Promise.race([innerRequest, timer]);
```

This ensures you respond to the mobile client before its connection drops, even if Fintava is slow.

### 3. Environment Variables Required

```
FINTAVA_BASE_URL=https://apifintavapay.com/api/dev
FINTAVA_API_KEY=<live or sandbox key>
FINTAVA_WEBHOOK_SECRET=<from merchant dashboard>
```

### 4. Merchant Account Activation

Before any API calls work, you must **activate the merchant profile** in the Fintava dashboard. A fresh merchant account in "pending" state will return:

```json
{ "status": false, "message": "merchant is not active" }
```

on all endpoints. Log into the Fintava dashboard → Settings → Merchant Profile → Activate.

### 5. Raw Body for Webhook Verification

NestJS parses the request body before your controller runs. To preserve the raw body for HMAC verification, configure `rawBody: true` in your NestJS bootstrap:

```typescript
// main.ts
const app = await NestFactory.create(AppModule, { rawBody: true });
```

Then access it via `req.rawBody` in controllers that use `@Req()`.

---

## Critical Gotchas

These are real issues discovered in production — not theoretical warnings.

### 1. Endpoint is `/create/customer`, not `/customers`

The official documentation lists `POST /customers`. The working endpoint is `POST /create/customer`. Using `/customers` returns 404.

### 2. Authorization header requires `Bearer` prefix

`Authorization: <key>` fails with 401. Must be `Authorization: Bearer <key>`.

### 3. `fundingMethod: 'STATIC_FUND'` is required

Without this field in the customer creation payload, Fintava does not provision a static NUBAN. The customer record is created but no virtual account is assigned.

### 4. Field is `dateOfBirth`, not `dob`

The correct payload field name is `dateOfBirth`. Sending `dob` may silently succeed but fail NIBSS validation, resulting in a 502 from NIBSS.

### 5. `sourceId` for `/bank/credit` must be `userInfo.id`

The customer creation response contains two UUIDs. Using `data.id` instead of `data.userInfo.id` causes HTTP 500 with no meaningful error message.

```
data.id          → bbd951dd-...  ← WRONG sourceId
data.userInfo.id → c57dc5f3-...  ← CORRECT sourceId
```

### 6. Sort codes: CBN 3-digit → Fintava 6-digit

Users submit CBN 3-digit codes (from their bank statements). The Fintava API requires 6-digit codes. Convert using `CBN_TO_FINTAVA_BANK_CODE` before every `/bank/credit`, `/bank/credit/merchant`, and `/name/enquiry` call.

### 7. Webhook amounts are in kobo, request amounts are in naira

- **Sending (requests):** whole naira (`5000` = ₦5,000)
- **Receiving (webhooks):** kobo (`500000` = ₦5,000)

Forgetting to divide webhook amounts by 100 causes 100× over-crediting.

### 8. Webhook signature may be hex or base64

Fintava environments vary. Always try hex comparison first, then base64 as fallback. Plain string comparison as last resort. Never reject the webhook just because the first comparison fails.

### 9. No customer lookup API exists

`GET /fetch-customer` and `GET /get-customer-by-phone-number` return 404 on all tested environments. Recovery from a 409 duplicate registration is only possible via the `dedicatedaccount.assign.success` webhook or the merchant dashboard.

### 10. NIN must be omitted — not sent as empty string

`"nin": ""` causes Fintava to return `"nin must be a number string"`. If NIN is unavailable, remove the key from the payload entirely.

### 11. `/single/transfer` is deprecated

Returns `{"status":"404","message":"Endpoint is deprecated!"}`. Use `POST /transaction/wallet-to-wallet` instead.

### 12. Merchant dashboard balance is not aggregate customer balance

"Income" on the Fintava dashboard = aggregate inflows across customer wallets. The merchant's own spendable "Total Balance" is typically near zero unless you have funded it directly or routed fees into it.

### 13. BVN and NIN must belong to the same person

A mismatch causes Fintava to return HTTP 502 from NIBSS. Validate identity documents before calling the activation API.

---

## Error Reference

| HTTP Status | Message | Cause | Fix |
|---|---|---|---|
| `401` | `Unauthorized` / `invalid api key` | Missing `Bearer` prefix, or wrong key | Use `Authorization: Bearer <key>` |
| `400` | `nin must be a number string` | `nin: ""` in payload | Omit `nin` key entirely when blank |
| `400` | `sourceId, accountNumber, sortCode required` | Wrong field names for endpoint | Use correct field names per endpoint |
| `400` | `same customer not allowed` | `senderAccount` === `receiverAccount` | Expected for self-transfer tests |
| `404` | `Endpoint is deprecated!` | Called `POST /single/transfer` | Use `/transaction/wallet-to-wallet` |
| `409` | `TypeORMError: Customer with email or Phone exists` | Duplicate customer registration | Check 409 body for recovered IDs; await `dedicatedaccount.assign.success` webhook |
| `500` | `An unexpected error occurred` | Wrong `sourceId` (top-level `id`), or mobile money account | Store and use `data.userInfo.id`; for mobile money accounts, ask user for a traditional bank account |
| `502` | `merchant is not active` | Merchant account not yet activated in dashboard | Activate merchant profile in Fintava dashboard |
| `502` | (NIBSS error) | BVN/NIN mismatch or DOB doesn't match BVN record | Verify identity documents; check `dateOfBirth` format |
| `503` / `504` | `Wallet service unreachable` / timeout | Fintava DNS hang (IPv4 issue) or slow response | Force `family: 4` (IPv4) in Node.js HTTP options; ensure 5s hard timeout is in place |
