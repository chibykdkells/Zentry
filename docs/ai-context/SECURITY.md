# SECURITY.md — ZenDocx Security Rules

> Last updated: 2026-04-03
> Security is not a phase. It is implemented from line 1.
> Every item below is a hard requirement — not a suggestion.
> If any rule conflicts with a feature request, flag it before proceeding.

---

## Authentication & Token Security

### Tokens
- **Access token:** JWT, 15-minute expiry, signed with `JWT_ACCESS_SECRET` (min 64 chars)
- **Refresh token:** JWT, 7-day expiry, signed with `JWT_REFRESH_SECRET` (min 64 chars)
- **Access token storage:** Memory only (Zustand store). NEVER localStorage, NEVER sessionStorage, NEVER a cookie.
- **Refresh token storage:** httpOnly, Secure, SameSite=Strict cookie. Set by API server only.
- **Refresh token rotation:** Every refresh issues a new refresh token and invalidates the old one (stored as hash in Redis).
- **On logout:** Delete refresh token hash from Redis immediately.
- **On password reset:** Invalidate ALL refresh tokens for the user (delete all Redis keys for that userId).

### JWT Payload
Only include: `{ sub: userId, email, role, iat, exp }`
Never include: wallet balance, passwordHash, walletPin, or any sensitive field.

### Password Rules
- Minimum 8 characters
- At least 1 uppercase, 1 lowercase, 1 number, 1 special character
- Hashed with bcrypt, rounds: 12
- Never logged, never returned in any API response
- Never stored in plain text anywhere (DB, logs, Redis, env)

### Wallet PIN Rules
- Exactly 6 digits, numeric only
- Hashed with bcrypt, rounds: 10
- Required for all withdrawal requests and high-value actions
- Never returned in any API response
- Separate from login password — different credential, different purpose
- Max 5 wrong PIN attempts → lock for 15 minutes

### OTP Rules
- 6-digit numeric
- Generated with `crypto.randomInt(100000, 999999)` — never Math.random()
- Stored as bcrypt hash, never plain text
- Expires: 10 minutes
- Max attempts: 5 (then invalidate token, force re-send)
- Rate limit OTP send: 3 per hour per email, per IP

---

## API Security

### Route Protection
- `JwtAuthGuard` applied **globally** in `AppModule` — every route is protected by default
- Public routes explicitly decorated with `@Public()`
- Role enforcement via `@Roles(UserRole.X)` + `RolesGuard`
- Never rely on frontend-only role checks — always enforce on the backend

### Rate Limiting
Apply `@nestjs/throttler`:
```
Global:        100 requests / 60 seconds / IP
Auth routes:   10 requests / 60 seconds / IP
OTP send:      3 requests / 60 minutes / IP
Forgot pass:   3 requests / 60 minutes / IP
Payment init:  20 requests / 60 minutes / user
```

### Input Validation
- Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- All DTOs validated with `class-validator`
- All shared schemas validated with Zod (packages/validators)
- Validate on BOTH frontend (form schema) AND backend (DTO/pipe)
- Never trust client-supplied data for financial amounts — always recompute from DB

### CORS
- Restrict to explicit allowed origins via `ALLOWED_ORIGINS` env var
- Never use `origin: '*'` in any environment including development (use specific localhost)
- `credentials: true` to support httpOnly cookies

### Security Headers (Helmet.js)
Apply all Helmet defaults plus:
```
Content-Security-Policy: configured for Next.js
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

---

## Financial Security

### Escrow Integrity
- Escrow lock and release are DB atomic transactions — both succeed or both fail
- Escrow release is triggered ONLY by the Bull queue timer — never by API request
- Client cannot pass `amount` for order creation — server computes from service price in DB
- Wallet balance is recomputed from transaction ledger on suspicious discrepancy (audit function)

### Payment Webhooks
- Every gateway webhook MUST verify the signature before processing
- Verify using the gateway's secret (`HMAC-SHA512` or gateway-specific method)
- Reject any webhook with invalid signature with `403`
- Use idempotency: check if `gatewayRef` already exists in Transaction table before processing
- Never process the same payment twice (duplicate webhook protection)

### Withdrawal Security
- CBT must provide wallet PIN to initiate withdrawal
- Withdrawal only from `availableBalance` (not `escrowBalance`)
- Minimum withdrawal: configured in `SystemConfig` table (default ₦1,000)
- Admin approval required before payout is processed
- Bank account details verified by admin before first withdrawal

### Amount Validation
- Never trust client-sent `amount` for payments or orders
- For orders: fetch `service.totalPrice` fresh from DB at order creation
- For VTU: fetch current pricing from provider or DB config
- For withdrawals: validate requested amount <= availableBalance at time of processing

---

## Data Privacy

### API Responses — Never Include
- `passwordHash`
- `walletPin`
- `otpToken.token`
- `passwordReset.token`
- Raw gateway API keys or secrets
- Internal database IDs of other users (use public-facing references)

### Prisma Select
When returning user data, always use explicit `select` or `omit`:
```typescript
// CORRECT
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, firstName: true, email: true, role: true }
})

// WRONG — never return the full Prisma model
const user = await prisma.user.findUnique({ where: { id } })
return user; // includes passwordHash!
```

### File Uploads
- Scan for malware before storing (Cloudinary auto-scans, or add manual check)
- Restrict file types: PDF, JPG, PNG, WEBP only
- Max file size: 5MB per file
- Generate a unique filename on upload — never use user-provided filename
- All file access via signed, time-limited URLs (max 1 hour)
- Never expose raw storage bucket URLs

### Logs
- Never log passwords, PINs, OTPs, tokens, or payment card data
- Never log full request bodies on auth endpoints
- Structured JSON logs in production (use Pino or Winston)
- Log rotation configured — logs are not kept indefinitely

---

## Infrastructure Security

### Environment Variables
- `.env` files never committed to git (enforced by `.gitignore`)
- `.env.example` committed with all keys listed but empty values
- Secrets rotated every 90 days minimum
- CI/CD uses secrets manager (not hardcoded in pipeline files)

### Database
- Connection via SSL in production (`?sslmode=require` in DATABASE_URL)
- Connection pooling — never open connections directly (use Prisma pool)
- Least-privilege DB user: no DROP, no TRUNCATE on production user
- Backups: daily automated backup, 30-day retention

### Dependencies
- `pnpm audit` run in CI on every PR
- Dependabot or Renovate configured for automated security updates
- No unmaintained packages (last publish > 2 years without a clear reason)

### Error Handling
- Global `HttpExceptionFilter` catches all errors
- In production: generic message to client, full error logged server-side
- Stack traces NEVER sent to client in any environment
- HTTP 500 errors trigger an alert (Sentry or equivalent)

---

## CBT-Specific Security

### Job Pool Access
- Only `CBT_CENTER` role with `approvalStatus: APPROVED` can view the job pool
- CBT can only claim ONE job at a time per service category (prevent hoarding)
- Job claim is atomic — concurrent claims resolved by DB transaction (first write wins)
- CBT cannot view requester's personal data beyond what's needed for the job

### File Upload (Result)
- CBT can only upload result for orders assigned to them (`assignedCbtId === cbt.id`)
- Result files validated for type and size before acceptance
- Result file URL stored in `order.resultFileUrl` — overwrite only allowed if dispute `REDO_REQUESTED`

### Dispute Penalties
- Admin can deduct from CBT `availableBalance` only if balance >= deduction amount
- Deduction creates a `Transaction` record of type `PENALTY`
- CBT notified of penalty with reason attached

---

## Security Checklist (verify before every PR merge)

- [ ] No hardcoded secrets, API keys, or passwords in code
- [ ] No `console.log` of sensitive data
- [ ] All new routes: either `@Public()` or protected by `JwtAuthGuard` + `@Roles()`
- [ ] Money amounts not trusted from client input
- [ ] Webhook signature verified before processing
- [ ] File uploads validated for type and size
- [ ] New DB queries use Prisma (no raw SQL without review)
- [ ] Error responses don't expose internal details
- [ ] Audit log added for any new financial or auth action
- [ ] Rate limiting applied to any new public endpoint
