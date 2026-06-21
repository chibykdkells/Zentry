# FintavaPay Wallet Integration — Step-by-Step Guide

> This documents the actual FintavaPay integration built in this project: what it does,
> how it's wired up, the exact API contract, and every gotcha discovered while getting it
> to work in production. Read this before touching `fintavapay.provider.ts` or the wallet
> funding/withdrawal flow.

---

## 1. What this integration does

ZenDocx uses FintavaPay as the **primary payment gateway** for wallet funding and
withdrawals (Paystack was removed entirely; Flutterwave remains as a backup option
behind the same `IPaymentProvider` interface).

Two flows are covered:

1. **Funding (money in)** — generate a one-time virtual bank account per transaction.
   The user transfers money to it; FintavaPay sends a webhook when the transfer lands.
2. **Withdrawal (money out)** — push a payout directly to the user's bank account.

FintavaPay does **not** use dedicated/permanent virtual accounts per user. Every funding
request creates a fresh, single-use virtual account tied to that one transaction
reference. This was a deliberate decision — see Decision Log below.

---

## 2. Architecture — where the code lives

```
apps/api/src/providers/
├── interfaces/index.ts              # IPaymentProvider contract (gateway-agnostic)
├── payment/
│   ├── fintavapay.provider.ts       # FintavaPay implementation (this guide)
│   ├── flutterwave.provider.ts      # Backup gateway, same interface
│   └── payment.service.ts           # Thin wrapper business logic calls
└── providers.module.ts              # Picks active provider via ACTIVE_PAYMENT_PROVIDER
```

**Rule:** business logic (`wallet.service.ts`) never imports `FintavapayProvider`
directly — it only talks to `PaymentService`, which delegates to whichever provider
`ACTIVE_PAYMENT_PROVIDER` selects. This is what makes Paystack removal / Flutterwave
fallback possible without touching wallet logic.

---

## 3. Environment variables

Set on the API app (`fly secrets set ...`, single-quoted — see gotcha #1 below):

| Variable | Purpose |
|---|---|
| `ACTIVE_PAYMENT_PROVIDER` | Must be `FINTAVAPAY` (defaults to this if unset) |
| `FINTAVAPAY_BASE_URL` | `https://live.fintavapay.com/api/dev` for live keys |
| `FINTAVAPAY_SECRET_KEY` | Bearer token for all API calls — starts with `live_$2b$...` |
| `FINTAVAPAY_PUBLIC_KEY` | Not currently used by the provider, kept for reference |
| `FINTAVAPAY_WEBHOOK_SECRET` | HMAC-SHA512 secret for verifying inbound webhooks |

**Important:** the base URL is the same domain pattern for both sandbox and live —
the environment is determined by *which key* you use (`live_...` vs sandbox key),
not by a different hostname. Don't assume `dev.fintavapay.com` vs `live.fintavapay.com`
without checking which key is active — these were both tried during integration and
`live.fintavapay.com` is what actually worked with live keys.

---

## 4. The funding flow, step by step

### Step 1 — Wallet service calls `PaymentService.initiatePayment()`

In `wallet.service.ts` → `initiateFunding()`:
- Computes `amountKobo` from the user's requested Naira amount.
- Calculates a 2.99% fee on top: `fundingFeeKobo = ceil(amountKobo * 0.0299)`,
  `fundingTotalKobo = amountKobo + fundingFeeKobo`.
- Creates a `PENDING` `Transaction` row with `amount = amountKobo` (the **original**
  amount, not including the fee — this matters for webhook reconciliation, see below).
- Calls `paymentService.initiatePayment({ amountKobo: fundingTotalKobo, ... })` —
  the gateway receives the fee-inclusive total, so the user transfers the gross amount.

### Step 2 — `FintavapayProvider.initiatePayment()` calls the gateway

```
POST {baseUrl}/virtual-wallet/generate
Authorization: Bearer {FINTAVAPAY_SECRET_KEY}

{
  "customerName": "...",
  "phone": "...",
  "email": "...",
  "amount": 514.95,            // whole Naira, FLOAT — not Kobo, no integer-only
  "expireTimeInMin": 30,
  "merchantReference": "ZDX-TXN-...",
  "description": "ZenDocx wallet funding"
}
```

Response (confirmed live shape — Fintava wraps in a `data` object, but the provider
defensively checks both flat and nested shapes):

```json
{
  "data": {
    "virtualAcctNo": "0054870933",
    "bank": "Loma Bank",
    "virtualAcctName": "ZENDOCX-CHIBUIKE",
    "id": "..."
  }
}
```

**Field name gotcha:** the actual response keys are `virtualAcctNo`, `bank`, and
`virtualAcctName` — *not* `accountNumber` / `bankName` / `accountName` as you'd guess
from generic gateway conventions. The provider maps these explicitly:

```ts
const accountNumber = data['virtualAcctNo'] ?? data['accountNumber'] ?? '';
const bankName       = data['bank'] ?? data['bankName'] ?? '';
const accountName    = data['virtualAcctName'] ?? data['accountName'] ?? '';
```

### Step 3 — User transfers money to the displayed virtual account

The frontend (`fund-wallet-modal.tsx`) shows the bank name, account number, and the
**fee-inclusive total** (`fundingTotalKobo`) as "Amount to transfer" — no fee breakdown
is shown at this stage, just the final number to send.

### Step 4 — FintavaPay sends a webhook on successful transfer

```
POST /wallet/webhooks/payment
x-fintava-signature: <hex or base64 HMAC-SHA512 of raw body>

{
  "type": "...",
  "data": {
    "merchantReference": "ZDX-TXN-...",
    "amount": 51495,           // KOBO this time, NOT Naira — different from the request!
    "id": "..."
  }
}
```

**Amount-unit gotcha:** the `/virtual-wallet/generate` *request* takes whole Naira
(float), but the *webhook payload* amount is in **Kobo** already. Do not multiply by
100 again — store it directly as `BigInt`.

**Fee reconciliation gotcha:** because the user transferred the fee-inclusive total
(`fundingTotalKobo`) but the wallet should only be credited the original amount, the
webhook handler in `wallet.service.ts` deliberately uses `transaction.amount` (the
original pending amount stored in step 1) rather than the gateway-reported
`parsed.amountKobo` when calling `completeFundingTransaction()`. If you instead pass
the gateway's reported amount, it will mismatch the pending transaction's stored amount
and `completeFundingTransaction` throws `BadRequestException` ("Confirmed amount did
not match...").

### Step 5 — Manual fallback: "I've made the transfer"

If the webhook is delayed, the frontend lets the user click "I've made the transfer",
which calls `POST /wallet/fund/confirm` → `confirmFundingReference()` →
`paymentService.verifyPayment(reference)`:

```
GET {baseUrl}/transaction/reference/{reference}
```

This call is wrapped in try/catch — if FintavaPay has no record yet (user hasn't
actually transferred), it throws, and the catch converts it to a friendly
`BadRequestException` ("Transfer not received yet...") instead of bubbling up as a raw
500 error.

---

## 5. The withdrawal flow, step by step

### Step 1 — User submits a withdrawal request

`wallet.service.ts` → `createWithdrawalRequest()`:
- `feeKobo = ceil(amountKobo * 0.0299)`
- `payoutKobo = amountKobo - feeKobo`
- Stores both on the `WithdrawalRequest` row (`feeKobo`, `payoutKobo` columns —
  added via migration `20260619000000_add_withdrawal_fee_fields`).
- Reserves `amountKobo` from the user's available balance immediately.

The frontend (`withdrawal-request-form.tsx`) shows only two lines: "Transaction fee
(2.99%)" and "You will receive" — no breakdown of the requested amount itself.

### Step 2 — Admin (SUPER_ADMIN or TENANT_ADMIN) reviews the request

`reviewWithdrawalRequest()` — approve / mark processing / complete / reject.
On **completion**, `initiateTransfer()` is called with `payoutKobo` (not the full
requested amount) as `amountKobo`:

```ts
const transferAmount = result.payoutKobo > 0n ? result.payoutKobo : result.amount;
await this.paymentService.initiateTransfer({ amountKobo: transferAmount, ... });
```

### Step 3 — `FintavapayProvider.initiateTransfer()` calls the payout endpoint

```
POST {baseUrl}/bank/credit/merchant

{
  "accountNumber": "...",
  "accountName": "...",
  "sortCode": "...",          // this is the bank CODE, named sortCode in Fintava's API
  "amount": 485.05,            // whole Naira again
  "CustomerReference": "ZDX-TXN-...",
  "narration": "..."
}
```

---

## 6. Bank list

`GET {baseUrl}/banks` — **not** `/bank/list` (an earlier, incorrect guess). Returns
~365 Nigerian banks with `code`/`name` (or `sortCode`/`bankName`) fields. The provider
tries both shapes and fails soft (returns `[]`) on any error rather than blocking the
withdrawal form from rendering.

---

## 7. Webhook signature verification

FintavaPay signs webhooks with HMAC-SHA512 over the raw request body, sent in the
`x-fintava-signature` header. The digest encoding (hex vs base64) isn't documented
consistently, so `parseWebhook()` computes both and accepts either, using
`crypto.timingSafeEqual` for the actual comparison (never `===` on raw signatures).

---

## 8. Reliability hardening

- **Force IPv4** on every outbound Axios call (`family: 4` on both http/https agents).
  FintavaPay's DNS occasionally resolves an IPv6 address from Fly.io's network, which
  hangs indefinitely instead of failing fast.
- **12-second hard timeout** on every request. FintavaPay can take 3–8s to respond;
  mobile browsers drop idle connections around 8–10s, so the API must always resolve
  (success or failure) before the client gives up.
- **Error logging on `initiatePayment` failures** logs the actual status code, error
  code, and response body from FintavaPay — this was added after "Could not initialize
  wallet funding right now" was the only visible error, with the real cause hidden.

---

## 9. Decision log (why things are the way they are)

- **No dedicated per-user virtual accounts.** Early integration attempts tried
  `/create/customer` to give each user a permanent account. This was explicitly
  rejected — FintavaPay's per-transaction `/virtual-wallet/generate` model fits the
  escrow/wallet-funding use case better and avoids managing account lifecycle per user.
- **Paystack removed entirely**, not just deprioritized — deleted the provider file,
  removed `PaymentGateway.PAYSTACK` from the shared enum, removed it from the provider
  factory switch. FintavaPay is now the default (`ACTIVE_PAYMENT_PROVIDER` defaults to
  `FINTAVAPAY` if unset).
- **2.99% fee split**: FintavaPay charges the platform ~1.5% per transaction; the
  platform charges the user 2.99%, retaining ~1.49% as margin. Applied to **both**
  funding and withdrawals — not just withdrawals as first implemented.
- **Funding fee is invisible to the user as a line item** — by design, only the final
  "amount to transfer" is shown (gross, fee-inclusive). Withdrawal fee, by contrast,
  *is* shown explicitly as a deduction, since the user is receiving less than requested
  and needs to see why.

---

## 10. Common failure modes encountered (for future debugging)

| Symptom | Root cause | Fix |
|---|---|---|
| "Could not initialize wallet funding right now" | Several stacked causes — see below | — |
| → Stale machine serving old code | Old Fly.io machine in a different region (`jnb`) wasn't redeployed | Destroy stale machine, redeploy |
| → Wrong field names | Provider read `accountNumber` instead of `virtualAcctNo` | Map actual Fintava field names |
| → Wrong active provider | `ACTIVE_PAYMENT_PROVIDER=PAYSTACK` left over | Set to `FINTAVAPAY` |
| → Corrupted secret key | `fly secrets set KEY="live_$2b$..."` — shell expanded `$2b`, `$05` as variables | Always single-quote secrets containing `$` |
| → Wrong bank list endpoint | Used `/bank/list` | Correct endpoint is `/banks` |
| "An unexpected error occurred" on "I've made the transfer" | `verifyPayment()` threw uncaught when no payment record existed yet | Wrap in try/catch, return friendly `BadRequestException` |
| Withdrawal review TypeScript build failures | Prisma `select` clauses missing newly-added `feeKobo`/`payoutKobo` fields | Add fields to every `select` that returns a withdrawal record |

---

## 11. Security note

The FintavaPay secret key is a **live** credential. If a key is ever pasted into chat,
a ticket, or committed to git, treat it as compromised and regenerate it immediately in
the FintavaPay dashboard — do not assume "no one saw it." Never log the raw key value;
the provider's error logging intentionally only logs response status/body, never the
`Authorization` header.
