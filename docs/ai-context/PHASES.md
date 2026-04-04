# PHASES.md — Zentry Build Phase Tracker

> Last updated: 2026-04-04
> This file tracks exactly what has been built and what has not.
> AI assistants MUST check this before writing any code to avoid
> building things out of phase or duplicating completed work.
> Update this file at the end of every session.

---

## Current Status

```
Active Phase  : PHASE 1 — In progress
Last Session  : 2026-04-04 (Role migration + dashboard/auth cleanup completed and verified)
Next Action   : User review and browser testing of the migration slice before prompting the next feature
```

---

## Phase Overview

| Phase | Title | Status |
|---|---|---|
| 1 | Foundation & Authentication | IN PROGRESS |
| 2 | Wallet & Payment Integration | NOT STARTED |
| 3 | Service Catalog & Order System | NOT STARTED |
| 4 | CBT Job Pool & Fulfillment | NOT STARTED |
| 5 | Escrow Release & Commission Engine | NOT STARTED |
| 6 | Dispute & Resolution System | NOT STARTED |
| 7 | VTU Automated Services | NOT STARTED |
| 8 | Withdrawal System | NOT STARTED |
| 9 | Real-time & Push Notifications | NOT STARTED |
| 10 | Admin Analytics, Security Audit & Launch | NOT STARTED |

---

## Phase 1 — Foundation & Authentication

**Goal:** Working monorepo, complete auth system for all roles, base UI shell,
PWA installable, Provider Abstraction Layer interfaces defined.

### Backend Checklist
- [x] pnpm monorepo with Turborepo initialized
- [x] apps/web created
- [x] apps/api created
- [x] packages/types created with shared enums and interfaces
- [x] packages/utils created with kobo and reference utilities
- [x] packages/validators created with auth Zod schemas
- [x] PostgreSQL connection configured (Prisma)
- [x] Redis connection configured
- [x] Full Prisma schema migrated (all models)
- [x] Seed data created and runs successfully
- [x] AuthModule: registration (all 3 user types)
- [x] AuthModule: email OTP verification
- [x] AuthModule: login with JWT + refresh token
- [x] AuthModule: silent refresh token rotation
- [x] AuthModule: logout (Redis token invalidation)
- [x] AuthModule: forgot password
- [x] AuthModule: reset password
- [x] AuthModule: set wallet PIN
- [x] AuthModule: change wallet PIN
- [x] AuthModule: GET /auth/me
- [x] JwtAuthGuard applied globally
- [x] RolesGuard implemented
- [x] @Public() decorator implemented
- [x] @CurrentUser() decorator implemented
- [x] @Roles() decorator implemented
- [ ] Global ZodValidationPipe configured
- [x] Global HttpExceptionFilter (no stack traces in production)
- [x] TransformInterceptor (standard API response shape)
- [ ] AuditLogInterceptor (logs auth events)
- [x] Helmet.js middleware
- [x] CORS configured (env-based origins)
- [x] Rate limiting (Throttler) configured globally
- [ ] Provider interfaces defined (IPaymentProvider, IVtuProvider, etc.)
- [ ] PaymentService shell (delegates to adapters — adapters can be mocked)
- [ ] SmsService + Termii adapter
- [ ] EmailService + Resend adapter
- [ ] StorageService + Cloudinary adapter (for license doc uploads in CBT onboarding)
- [ ] UsersModule (profile read/update)
- [x] .env.example committed

### Frontend Checklist
- [ ] Frontend stack fully aligned with architecture doc (current app is Next.js 16 + Tailwind 4 and does not yet include shadcn/ui)
- [ ] Tailwind config with Zentry brand tokens
- [ ] Plus Jakarta Sans fully configured from local assets
- [x] PWA manifest.json (name, icons, colors)
- [ ] next-pwa configured
- [x] Axios API client with JWT interceptor + silent refresh
- [ ] TanStack Query configured
- [x] Zustand auth store
- [ ] Zustand notification store
- [ ] Root layout with providers (QueryClient, Zustand, Toaster)
- [x] Middleware.ts for auth-based routing
- [x] (auth) route group: Login page
- [x] (auth) route group: Register pages (public individual path + dedicated cyber cafe / CBT entry paths)
- [x] (auth) route group: OTP verification page
- [x] (auth) route group: Forgot password page
- [x] (auth) route group: Reset password page
- [x] (dashboard) route group: layout with sidebar + bottom nav
- [x] (dashboard) route group: Home/dashboard page
- [x] (dashboard) route group: Profile page
- [x] (cbt) route group: layout with CBT sidebar + bottom nav
- [x] (cbt) route group: dashboard page (skeleton)
- [x] (admin) route group: layout
- [x] (admin) route group: dashboard page (skeleton)
- [x] BottomNav component (mobile, role-aware)
- [ ] Sidebar component extracted as its own reusable component
- [x] TopBar component (notification bell, user avatar)
- [x] MoreSheet component (Framer Motion slide-up)
- [ ] OtpInput component (6 separate boxes, auto-advance)
- [x] StatCard component
- [x] EmptyState component (illustrated)
- [ ] SkeletonLoader components
- [x] WalletCard component (dark premium card, placeholder balance)
- [x] Wallet page shell
- [ ] PWA installable on mobile (test on Android Chrome + iOS Safari)

### Security Checklist (Phase 1)
- [x] bcrypt rounds: 12 for passwords, 10 for PINs
- [x] JWT secrets minimum 64 characters in .env.example notes
- [x] OTP max 5 attempts enforced
- [x] Refresh token stored as hash in Redis
- [x] Refresh token rotation implemented
- [x] Access token in memory only (verified in frontend state)
- [x] httpOnly cookie for refresh token
- [x] Audit log for: REGISTER, EMAIL_VERIFIED, LOGIN, LOGOUT, PASSWORD_RESET, PIN_SET, PIN_CHANGED
- [x] No email enumeration on forgot-password
- [x] No stack traces in production error responses

### Acceptance Criteria
- [ ] `pnpm dev` starts both apps simultaneously
- [ ] All 4 roles can register, verify email, and login
- [ ] Token refresh works silently on 401
- [ ] Role-based routing works (individual/cyber cafe sees `/home`, CBT sees `/dashboard`)
- [x] Mobile bottom nav renders with More sheet animation
- [x] Desktop sidebar shell renders
- [ ] App is installable as PWA on mobile
- [x] `pnpm typecheck` passes with zero errors
- [x] `pnpm lint` passes with zero errors
- [ ] `pnpm db:migrate` runs successfully
- [ ] `pnpm db:seed` runs successfully and is idempotent

### Notes
- Verification completed on 2026-04-03:
  `pnpm typecheck` passed, `pnpm lint` passed, `pnpm test` passed, and `pnpm build` passed after adding the remaining auth pages, route protection middleware, and lightweight CBT/admin shells.
- Local startup fix completed on 2026-04-03:
  the API now resolves env files more reliably from either the repo root or `apps/api`, and `compose.yml` now provides a matching local PostgreSQL + Redis stack for the checked-in defaults.
- Web startup fix completed on 2026-04-03:
  the web app now uses webpack for local `pnpm dev`, and Next config only keeps the workspace-root setting needed for webpack tracing instead of the previous Turbopack root override that broke Tailwind resolution.
- Profile + wallet shell completed on 2026-04-04:
  shared protected account pages now exist at `/profile` and `/wallet`, both backed by live `/auth/me` data and protected by middleware.
- Role migration + dashboard/auth cleanup completed on 2026-04-04:
  the public user role is now `INDIVIDUAL` across the schema, API, validators, seeds, middleware, and frontend copy; login and dashboard visuals were simplified, dedicated cyber cafe / CBT registration entry points were added, the More sheet logout flow was fixed, and placeholder pages were added for previously broken linked routes.
- Remaining gaps are mostly unfinished Phase 1 scope, not broken core scaffolding:
  missing provider service modules beyond payment adapters, no local-asset Plus Jakarta Sans setup, no `next-pwa` integration, and no live end-to-end browser verification recorded for this session.

---

## Phase 2 — Wallet & Payment Integration

**Goal:** Wallet funding via FintavaPay/Paystack/Flutterwave, transaction
history, wallet dashboard UI.

### Key Deliverables
- [ ] WalletModule: get balance, transaction history
- [ ] PaymentModule: initiate funding (all 3 gateways)
- [ ] Payment webhook handlers with signature verification
- [ ] Idempotency check on webhook processing
- [ ] Wallet funding confirmation + real-time balance update
- [ ] Transaction history paginated API
- [ ] Wallet page UI (premium dark card, balance, transactions list)
- [ ] Fund Account modal/flow
- [ ] Transaction history with filters (type, date range)
- [ ] Admin: view all user wallets, platform wallet

---

## Phase 3 — Service Catalog & Order System

**Goal:** Admin creates services. Individuals/Cafes browse, submit orders, upload
docs. Funds escrowed at order creation.

### Key Deliverables
- [ ] ServiceCategory + Service CRUD (admin only)
- [ ] Dynamic form field system (admin defines fields, requester fills them)
- [ ] Order creation with escrow lock (atomic transaction)
- [ ] Document upload to Cloudinary
- [ ] Order listing + status tracking
- [ ] Service catalog UI (categorized, filterable)
- [ ] Order placement flow UI (multi-step: fill form → upload docs → confirm → pay from wallet)
- [ ] My Orders page UI (grouped by category, like competitor screenshot)

---

## Phase 4 — CBT Job Pool & Fulfillment

**Goal:** CBT onboarding/approval, real-time job pool, job claiming, result
upload, 2-hour dispute window timer starts.

### Key Deliverables
- [ ] CBT registration with license upload
- [ ] Admin: CBT approval/rejection flow
- [ ] Job pool endpoint (filtered by service category CBT serves)
- [ ] Job claim (atomic — first write wins)
- [ ] Result file upload endpoint (CBT only, for their assigned order)
- [ ] Order status update flow (ASSIGNED → IN_PROGRESS → COMPLETED)
- [ ] Bull queue: RELEASE_ESCROW job scheduled on result upload
- [ ] Requester notified: result available, download link (signed URL)
- [ ] Job pool UI (CBT) — real-time via Socket.io
- [ ] Admin: CBT approvals dashboard

---

## Phase 5 — Escrow Release & Commission Engine

**Goal:** Automatic escrow release after 2-hour window. Commission split to
platform and CBT. CBT earnings dashboard.

### Key Deliverables
- [ ] Bull job processor: RELEASE_ESCROW
- [ ] Atomic: release escrow → debit escrow → credit CBT → credit platform
- [ ] CBT commission credited with `withdrawable: true` after 2hrs
- [ ] CBT earnings history endpoint (paginated)
- [ ] CBT earnings dashboard UI (bar chart by service, lifetime totals)
- [ ] Platform commission tracking in admin analytics

---

## Phase 6 — Dispute & Resolution System

**Goal:** Requesters can raise disputes within 2-hour window. Admin reviews
and resolves. CBT can be penalised or asked to redo.

### Key Deliverables
- [ ] Dispute creation endpoint (requester, within dispute window only)
- [ ] Dispute cancels Bull RELEASE_ESCROW job
- [ ] Dispute dashboard for admin
- [ ] Admin actions: resolve-for-requester | resolve-for-cbt | request-redo
- [ ] Redo flow: order returns to IN_PROGRESS, CBT notified, new deadline set
- [ ] Penalty: deduct from CBT available balance, create PENALTY transaction
- [ ] Dispute UI for requester (raise dispute, evidence upload)
- [ ] Dispute management UI for admin

---

## Phase 7 — VTU Automated Services

**Goal:** Airtime, Data, Cable TV, Electricity go live. Direct API call,
instant result, no CBT involvement.

### Key Deliverables
- [ ] VTU provider adapter implemented (real provider API)
- [ ] VTU order flow: create order → call VTU API → return result instantly
- [ ] Data plans API: live plans from provider, cached in Redis (5 min TTL)
- [ ] SmartCard/meter verification endpoints
- [ ] VTU result stored in order.providerResponse
- [ ] VTU commission taken immediately (no dispute window)
- [ ] VTU services UI: Airtime, Data, Cable TV, Electricity flows
- [ ] Airtime: network selector, amount, phone number
- [ ] Data: network selector, plan picker (with prices from provider)
- [ ] Cable TV: provider selector, smartcard verification, plan picker
- [ ] Electricity: disco selector, meter verification, amount entry, token display

---

## Phase 8 — Withdrawal System

**Goal:** CBTs can request bank withdrawals from their available balance.
Admin approves. FintavaPay processes payout.

### Key Deliverables
- [ ] Withdrawal request endpoint (CBT, requires wallet PIN)
- [ ] Minimum withdrawal validation (from SystemConfig)
- [ ] Admin: withdrawal queue + approve/reject
- [ ] FintavaPay payout API integration
- [ ] Withdrawal status tracking + CBT notification
- [ ] Withdrawal history UI (CBT)
- [ ] Admin withdrawal management UI
- [ ] Bank list endpoint (from payment provider)

---

## Phase 9 — Real-time & Push Notifications

**Goal:** WebSocket events for live job pool updates. PWA push notifications.
In-app notification center.

### Key Deliverables
- [ ] Socket.io server configured with JWT auth on connection
- [ ] User rooms: `user:{userId}`, `cbt:pool`
- [ ] Events: job:new, job:claimed, order:completed, notification:new, wallet:updated
- [ ] Notification creation on all key events (order, dispute, withdrawal, CBT approval)
- [ ] Notification center UI (bell icon, unread count badge, list)
- [ ] Mark as read / mark all as read
- [ ] PWA push notification subscription (service worker)
- [ ] Push notification sent on key events (server-side)
- [ ] Email notifications: order confirmed, result ready, dispute update
- [ ] SMS notifications: OTP (already done), key order updates

---

## Phase 10 — Admin Analytics, Security Audit & Launch

**Goal:** Full admin analytics dashboard. Security hardened. Performance
optimized. Production deployed.

### Key Deliverables
- [ ] Admin: platform revenue dashboard (daily/weekly/monthly charts)
- [ ] Admin: orders by service type (bar chart)
- [ ] Admin: CBT performance metrics (jobs completed, avg time, disputes)
- [ ] Admin: user growth chart
- [ ] Admin: wallet float overview (total escrowed, platform balance)
- [ ] Admin: export reports (CSV)
- [ ] Admin: system config management (dispute window, min withdrawal, etc.)
- [ ] Offline mode (service worker caches service list, order history)
- [ ] Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1
- [ ] Security headers verified (CSP, HSTS, etc.)
- [ ] pnpm audit: zero high/critical vulnerabilities
- [ ] Load testing: simulate 500 concurrent users
- [ ] Sentry error monitoring configured
- [ ] UptimeRobot (or equivalent) health monitoring
- [ ] Production PostgreSQL with daily backups
- [ ] Production Redis with persistence configured
- [ ] Vercel deployment (frontend)
- [ ] Railway/Render deployment (backend)
- [ ] Cloudflare DNS + WAF configured
- [ ] All .env secrets moved to platform secret manager
- [ ] Launch checklist signed off

---

## What Is Intentionally NOT Built (Out of Scope)

- No mobile native app (iOS/Android) — PWA only
- No JAMB/NIMC direct API integration — services fulfilled by humans (CBTs)
- No chat/messaging between users — only notifications
- No subscription model — pay-per-service only
- No multi-currency — NGN only
- No referral system (may be added post-launch)
- No public API / third-party developer access
