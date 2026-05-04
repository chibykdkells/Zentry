# PHASES.md — ZenDocx Build Phase Tracker

> Last updated: 2026-05-03
> This file tracks exactly what has been built and what has not.
> AI assistants MUST check this before writing any code to avoid
> building things out of phase or duplicating completed work.
> Update this file at the end of every session.

---

## Current Status

```
Active Phase  : Phase 10 — Admin Analytics, Security Audit & Launch (IN PROGRESS)
Last Session  : 2026-05-04 (Wallet history sheet, layout/scroll fixes, services visibility fix, fund wallet redesign, accordion UX + URL deep link)
Next Action   : Configure Paystack: set Callback URL + Webhook URL in dashboard, set PAYSTACK_WEBHOOK_SECRET on Fly. Then: Sentry Vercel env vars, app.zendocx.net CNAME, silent refresh, PWA install flow
```

---

## Phase Overview

| Phase | Title | Status |
|---|---|---|
| 1 | Foundation & Authentication | IN PROGRESS |
| 2 | Wallet & Payment Integration | COMPLETED |
| 3 | Service Catalog & Order System | IN PROGRESS |
| 4 | CBT Job Pool & Fulfillment | COMPLETED |
| 5 | Escrow Release & Commission Engine | COMPLETED |
| 6 | Dispute & Resolution System | COMPLETED |
| 7 | VTU Automated Services | IN PROGRESS |
| 8 | Withdrawal System | COMPLETED (payout wired 2026-04-11) |
| 9 | Real-time & Push Notifications | IN PROGRESS |
| 10 | Admin Analytics, Security Audit & Launch | IN PROGRESS |

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
- [x] AuthModule: registration (individual + CBT, now tenant-context aware)
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
- [x] Global ZodValidationPipe configured
- [x] Global HttpExceptionFilter (no stack traces in production)
- [x] TransformInterceptor (standard API response shape)
- [x] AuditLogInterceptor (logs auth events)
- [x] Helmet.js middleware
- [x] CORS configured (env-based origins)
- [x] Rate limiting (Throttler) configured globally
- [x] Provider interfaces defined (IPaymentProvider, IVtuProvider, etc.)
- [x] PaymentService shell (delegates to adapters — adapters can be mocked)
- [x] SmsService + Termii adapter
- [x] EmailService + Resend adapter (real SDK wired 2026-05-02 — was a stub returning Promise.resolve)
- [x] StorageService + Cloudinary adapter (for license doc uploads in CBT onboarding)
- [x] UsersModule (profile read/update)
- [x] .env.example committed

### Frontend Checklist
- [x] Frontend stack fully aligned with architecture doc
- [x] Tailwind config with ZenDocx brand tokens
- [x] Plus Jakarta Sans fully configured from local assets
- [x] PWA manifest.json (name, icons, colors)
- [x] next-pwa configured
- [x] Axios API client with JWT interceptor + silent refresh
- [x] TanStack Query configured
- [x] Zustand auth store
- [x] Zustand notification store
- [x] Root layout with providers (QueryClient, Zustand, Toaster)
- [x] Proxy.ts for auth-based routing
- [x] (auth) route group: Login page
- [x] (auth) route group: Register pages (public individual path + dedicated CBT entry path, now tenant-context aware)
- [x] (auth) route group: OTP verification page
- [x] (auth) route group: Forgot password page
- [x] (auth) route group: Reset password page
- [x] (dashboard) route group: layout with sidebar + bottom nav
- [x] (dashboard) route group: Home/dashboard page
- [x] (dashboard) route group: Profile page
- [x] (cbt) route group: layout with CBT sidebar + bottom nav
- [x] (cbt) route group: dashboard page (skeleton)
- [x] (admin) route group: layout
- [x] (admin) route group: dashboard page
- [x] BottomNav component (mobile, role-aware)
- [x] Sidebar component extracted as its own reusable component
- [x] TopBar component (notification bell, user avatar)
- [x] MoreSheet component (Framer Motion slide-up)
- [x] OtpInput component (6 separate boxes, auto-advance)
- [x] StatCard component
- [x] EmptyState component (illustrated)
- [x] SkeletonLoader components
- [x] WalletCard component (dark premium card, placeholder balance)
- [x] Wallet page shell
- [ ] PWA installable on mobile (manual test on Android Chrome + iOS Safari still pending)

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
- [x] Public tenant-scoped registration works for supported roles when tenant context is resolved
- [x] Seeded super admin can login and route to `/admin/dashboard`
- [ ] Token refresh works silently on 401 in a real browser session
- [x] Role-based routing works (individual sees `/home`, CBT sees `/dashboard`, tenant admin sees `/tenant/dashboard`)
- [x] Mobile bottom nav renders with More sheet animation
- [x] Desktop sidebar shell renders
- [ ] App is installable as PWA on mobile
- [x] `pnpm typecheck` passes with zero errors
- [x] `pnpm lint` passes with zero errors
- [x] `pnpm db:migrate` runs successfully
- [x] `pnpm db:seed` runs successfully and is idempotent

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
  the public user role is now `INDIVIDUAL` across the schema, API, validators, seeds, middleware, and frontend copy; login and dashboard visuals were simplified, dedicated public and CBT entry points were added, the More sheet logout flow was fixed, and placeholder pages were added for previously broken linked routes.
- Profile + wallet refinement completed on 2026-04-04:
  both account pages now have stronger information architecture, retry states for profile fetching, calmer wallet visuals, and Phase 2-ready placeholders for transactions and wallet controls without adding payment functionality early.
- Services + orders workspace slice completed on 2026-04-04:
  the main individual/cafe routes at `/services` and `/orders` now render useful frontend workspaces with service catalog structure, category filtering, order-tracking guidance, and stable empty states instead of generic placeholders.
- Notifications + security workspace slice completed on 2026-04-04:
  the top-bar bell now has a working local notification store and unread badge, `/notifications` is a real inbox workspace, and `/security` now exposes real wallet PIN set/change flows backed by the existing auth API.
- Support + disputes workspace slice completed on 2026-04-04:
  `/support` now works as a structured help center with guided actions and FAQs, while `/disputes` now explains dispute readiness, resolution expectations, and how dispute handling will connect to live order activity later.
- CBT workspace slice completed on 2026-04-04:
  the fulfiller-side routes at `/dashboard`, `/job-pool`, `/my-jobs`, `/earnings`, and `/withdraw` now form a coherent CBT workspace with proper desktop navigation, stable empty states, and Phase 4/5-ready information architecture.
- Admin workspace slice completed on 2026-04-04:
  the admin-side routes at `/admin/dashboard`, `/admin/orders`, `/admin/users`, and `/admin/finance` now form a coherent operations workspace with real sidebar navigation, calmer overview cards, and stable empty states instead of placeholders.
- Public landing + auth entry polish completed on 2026-04-04:
  the root `/` route now works as a clearer product entry page with dedicated account paths for individuals, tenant-linked portals, and CBT centers, and the shared auth shell now presents a more polished, role-aware entry experience.
- OTP verification + shared loading states completed on 2026-04-04:
  email verification now uses a dedicated six-box OTP input with paste support and auto-advance, and shared skeleton loader components now drive calmer loading states across verification, profile, and wallet pages.
- Shared desktop sidebar extraction completed on 2026-04-05:
  the duplicated desktop sidebar markup was replaced with a reusable sidebar component that now powers the individual, CBT, and admin layouts while preserving role-specific navigation.
- App providers + TanStack Query foundation completed on 2026-04-05:
  the web app now has a shared provider layer for QueryClient, auth bootstrap, and toast handling, and `/auth/me` profile loading now runs through TanStack Query instead of a custom local effect loop.
- Provider abstraction layer foundation completed on 2026-04-05:
  the API now has a global providers module, shared PAL interfaces for payment, VTU, SMS, email, and storage, plus adapter-backed service shells for payment, mocked VTU, Termii SMS, Resend email, and Cloudinary storage.
- UsersModule + profile update flow completed on 2026-04-05:
  the backend now exposes `/users/me` profile read/update endpoints, and the profile page now includes a real edit form backed by React Query invalidation and user-facing success/error feedback.
- Auth validation alignment completed on 2026-04-05:
  the API now runs a global Zod validation pipe, and the auth DTOs are linked to the shared Zod schemas so backend auth validation stays aligned with the frontend validator package.
- Audit-log interceptor completed on 2026-04-05:
  the API now has an opt-in audit interceptor and audit decorator that enrich existing auth/profile audit rows with request metadata and records selected request-level auth events like OTP resend and password reset requests.
- PWA install foundation completed on 2026-04-05:
  the web app now registers a custom service worker, caches the basic app shell, and surfaces an install prompt for supported browsers plus iOS Safari guidance, though `next-pwa` itself is still not configured.
- White-label roadmap documented on 2026-04-05:
  a dedicated future-state roadmap now exists in `docs/ai-context/WHITE_LABEL_ROADMAP.md`, defining the multi-tenant tenant model, hybrid wallet approach, tenant-owned customer relationship, subdomain/custom-domain strategy, and the staged provider plan of ZenDocx-managed providers first, then tenant-managed VTU and NIN only.
- Platform-first refinement documented on 2026-04-06:
  the roadmap and architecture docs now explicitly treat ZenDocx as the infrastructure layer, the launch business as the first-party tenant, and PWA/security as first-class constraints that must carry into the tenant expansion.
- PWA hardening completed on 2026-04-06:
  `next-pwa` is now configured for production builds, the old hand-rolled service worker was replaced, an app-router offline fallback page now exists at `/offline`, and the install prompt now avoids stale local service workers during development.
- Brand-token design system completed on 2026-04-06:
  the Tailwind 4 theme layer in `globals.css` now defines shared ZenDocx brand tokens for surfaces, borders, text, navy, and accent colors, and the shared auth shell, wallet card, stat card, sidebar, top bar, and install prompt now consume those tokens instead of scattered hard-coded values.
- Local font setup completed on 2026-04-06:
  the web app now self-hosts Plus Jakarta Sans through `@fontsource-variable/plus-jakarta-sans`, removing the remaining missing-font gap and avoiding any dependency on remote font fetching at build or runtime.
- Proxy convention migration completed on 2026-04-06:
  the web auth-routing layer now uses `src/proxy.ts` instead of the deprecated `src/middleware.ts` convention, removing the Next.js 16 deprecation warning without changing the redirect or guard logic.
- Stack-alignment cleanup completed on 2026-04-06:
  the architecture/context docs and web README now match the actual app stack: Next.js 16, Tailwind CSS v4, repo-native shared components instead of shadcn/ui, `INDIVIDUAL` instead of `STUDENT`, and `proxy.ts` instead of the old middleware convention.
- Security header baseline completed on 2026-04-06:
  the web app now ships a stricter header baseline through `next.config.ts`
  with CSP, referrer policy, clickjacking protection, content-type sniffing
  protection, permissions policy, and production HSTS, while the API bootstrap
  now applies matching Helmet/referrer/permissions protections without changing
  route behavior.
- Web typecheck stability completed on 2026-04-06:
  the web package `typecheck` script now runs `next typegen` before `tsc`, so
  route and app-router type files are regenerated automatically instead of
  failing when `.next/types` is stale or missing from a prior build.
- Workspace verification closeout completed on 2026-04-06:
  the web package `typecheck` script now pre-creates the Next type output
  folders before `next typegen`, fixing cold-run failures under Turborepo, and
  the root workspace now has a `verify:phase1` script that runs lint,
  typecheck, test, and build as one closeout command.
- Workspace verification re-confirmed on 2026-05-03:
  `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` all passed
  after reconciling tenant-aware mocks, frontend hydration-safe lint fixes, and
  current API lint/type debt. Remaining non-blocking build warnings are limited
  to Sentry App Router hardening and a large PWA source-map precache skip.
- Database closeout completed on 2026-04-06:
  the local Prisma migration history was reconciled with the already-applied
  `INDIVIDUAL` role rename, `pnpm db:migrate` and `pnpm db:seed` now pass
  against the Dockerized local database, and Prisma config was moved out of the
  deprecated `package.json#prisma` field into `apps/api/prisma.config.ts`.
- Runtime verification harness completed on 2026-04-06:
  the repo now includes a root `verify:phase1:runtime` script that checks all
  seeded roles against the live local web and API servers for login, `/auth/me`,
  refresh rotation, logout, and role-based proxy redirects; this verification
  confirmed role-routing behavior on the running stack.
- Refresh rotation hardening completed on 2026-04-06:
  JWT issuance now adds a unique `keyid` per token so login and refresh no
  longer risk emitting identical JWT strings when they happen within the same
  second, which makes refresh rotation deterministic during live runtime checks.
- Manual acceptance cleanup completed on 2026-04-06:
  protected-route redirects now preserve `?next=` through login, expired-session
  redirects now return users to `/login` with a human-readable message, and the
  remaining browser/mobile checks are documented in
  `docs/ai-context/PHASE1_MANUAL_ACCEPTANCE.md`.
- Remaining gaps are mostly unfinished Phase 1 scope, not broken core scaffolding:
  no live end-to-end browser verification recorded for this session.

---

## Phase 2 — Wallet & Payment Integration

**Goal:** Wallet funding via FintavaPay/Paystack/Flutterwave, transaction
history, wallet dashboard UI.

### Key Deliverables
- [x] WalletModule: get balance, transaction history
- [x] PaymentModule: initiate funding (all 3 gateways)
- [x] Payment webhook handlers with signature verification
- [x] Idempotency check on webhook processing
- [x] Wallet funding confirmation + real-time balance update
- [x] Transaction history paginated API
- [x] Wallet page UI (premium dark card, balance, transactions list)
- [x] Fund Account modal/flow
- [x] Transaction history with filters (type, date range)
- [x] Admin: view all user wallets, platform wallet

### Notes
- Phase 2 batch 1 completed on 2026-04-06:
  a dedicated `WalletModule` now serves `/wallet/me` and
  `/wallet/transactions`, the wallet page now reads live balance and recent
  transaction data from the new wallet API instead of piggybacking on the
  profile payload, and the seed now populates deterministic sample wallet
  balances plus transaction history for the seeded accounts.
- Phase 2 batch 2 completed on 2026-04-06:
  wallet funding can now be initialized through `POST /wallet/fund`, a pending
  `WALLET_FUNDING` transaction is created before checkout, the wallet page now
  exposes a real fund modal, and local development falls back to a sandbox
  checkout URL when gateway secrets are not configured yet.
- Phase 2 batch 3 completed on 2026-04-06:
  wallet funding can now be confirmed through `POST /wallet/fund/confirm`,
  payment webhooks are handled through `POST /wallet/webhooks/payment` with
  signature verification hooks in the provider layer, wallet crediting is
  idempotent, and the wallet page now reconciles sandbox checkout returns into
  a refreshed live balance update during development.
- Phase 2 batch 4 completed on 2026-04-06:
  `GET /wallet/transactions` now supports type, status, and date-range
  filtering, and the wallet page now exposes a live ledger workspace with
  filter controls, page navigation, and a preserved recent-activity snapshot
  alongside the filtered results.
- Phase 2 batch 5 completed on 2026-04-06:
  super admins can now access `GET /wallet/admin/overview` and
  `GET /wallet/admin/wallets` for platform wallet totals and paginated
  user-wallet visibility, and the admin finance page now renders those live
  backend views with role-aware filtering and search.
- Phase 2 batch 6 completed on 2026-04-06:
  super admins can now access `GET /wallet/admin/transactions` for live
  platform wallet activity with type, status, role, search, and date filters,
  and the admin finance page now exposes a real transaction feed covering
  funding, escrow movement, commissions, refunds, and withdrawals.

---

## Phase 3 — Service Catalog & Order System

**Goal:** Admin creates services. Individuals/Cafes browse, submit orders, upload
docs. Funds escrowed at order creation.

### Key Deliverables
- [x] ServiceCategory + Service CRUD (admin only)
- [ ] Dynamic form field system (admin defines fields, requester fills them)
- [x] Order creation with escrow lock (atomic transaction)
- [x] Document upload to storage provider for service requests
- [x] Order listing + status tracking
- [x] Service catalog UI (categorized, filterable)
- [x] Order placement flow UI (guided form → confirm → pay from wallet)
- [x] My Orders page UI (grouped by category, like competitor screenshot)

### Notes
- Phase 3 batch 1 completed on 2026-04-06:
  the API now has a dedicated `ServicesModule` with `GET /services/catalog`,
  backed by the seeded service and category data, and the `/services` page now
  renders a live categorized and searchable catalog from the backend instead of
  the earlier static in-memory mock list.
- Phase 3 batch 2 completed on 2026-04-06:
  the API now has an `OrdersModule` with `POST /orders` and `GET /orders/me`,
  order creation now validates required service fields and atomically moves
  wallet balance into escrow, the `/services` page now opens a guided order
  modal from live service records, and the `/orders` page now renders real
  order history and live status metrics.
- Phase 3 batch 3 completed on 2026-04-06:
  the live service catalog now exposes service-level document requirements,
  authenticated users can upload request files through `/orders/uploads`,
  document-aware manual services are seeded with real requirements, and order
  creation now persists `requesterDocUrls` while preserving the existing escrow
  lock flow.
- Phase 3 batch 4 completed on 2026-04-06:
  the API now exposes super-admin category and service management endpoints for
  list, create, and update flows, and the web app now has a live
  `/admin/services` workspace for catalog control with filters, category
  management, and service editing wired to the backend.
- Phase 3 batch 5 completed on 2026-04-06:
  the API now exposes requester order-detail and admin order queue/detail
  endpoints, the `/orders` page now has a live selected-order detail workspace,
  and the `/admin/orders` page now renders a real filtered queue plus full
  inspection view for the selected order.
- Phase 3 service-routing correction completed on 2026-04-07:
  services now carry an explicit `deliveryMode` so the platform can distinguish
  CBT-manual work from API-automated services and future PIN-stock products,
  seeded NIN validation and JAMB status/profile retrieval services are now
  classified as automated, and the CBT job pool now stays limited to true
  manual services instead of swallowing automated requests.
- Phase 3 batch 6 completed on 2026-04-06:
  the API now exposes CBT-facing dashboard, job-pool, my-jobs, and job-detail
  endpoints, seeded manual orders now include both available and already
  assigned CBT work, and the CBT routes at `/dashboard`, `/job-pool`, and
  `/my-jobs` now render live operational data instead of placeholders.
- Phase 3 remains partially open:
  dynamic admin-defined request fields and deeper admin service CRUD ergonomics
  are still pending, even though the order flow itself is now live enough to
  hand work into the CBT fulfillment side.

---

## Phase 4 — CBT Job Pool & Fulfillment

**Goal:** CBT onboarding/approval, real-time job pool, job claiming, result
upload, 2-hour dispute window timer starts.

### Key Deliverables
- [x] CBT registration with supporting doc (optional, not compulsory)
- [x] Admin: CBT approval/rejection flow (GET /users/admin/cbt, approve, reject with reason)
- [x] Job pool endpoint (filtered by service category CBT serves)
- [x] Job claim (atomic — first write wins)
- [x] Result file upload endpoint (CBT only, for their assigned order)
- [x] Order status update flow (ASSIGNED → IN_PROGRESS → COMPLETED)
- [x] Bull queue: RELEASE_ESCROW job scheduled on result upload
- [x] Requester notified: result available (notification + real-time event)
- [x] Job pool UI (CBT) — real-time via Socket.io (job:new invalidates query)
- [x] Admin: CBT approvals dashboard (/admin/cbt page)
- [x] CBT job delivery timer: 10-min deadline set on claim, enforced by Bull queue
- [x] CBT time extension request flow (CBT requests → tenant admin approves/rejects)
- [x] CbtJobBlock: prevents CBT from re-claiming jobs they missed or had extension rejected

### Notes
- Phase 4 batch 1 completed on 2026-04-06:
  CBT users can now claim live pending manual jobs atomically, move their own
  assigned jobs into `IN_PROGRESS`, and review those changes from the live
  `/dashboard`, `/job-pool`, and `/my-jobs` workspaces.
- Phase 4 batch 2 completed on 2026-04-06:
  CBT users can now upload a result file to complete their assigned job, the
  system now stamps `completedAt`, `resultUploadedAt`, and a 2-hour
  `disputeWindowExpiresAt`, and requester order detail now surfaces the result
  file and dispute-window timing.
- Phase 4 batch 3 completed on 2026-04-06:
  order summaries and details now expose a computed release state, requester
  order history highlights result readiness and remaining dispute-window time,
  and the admin orders workspace now supports release-state filters plus
  metrics for orders still in the review window versus ready for release.
- Phase 4 batch 4 completed on 2026-04-06:
  the admin dashboard now has a live operations overview endpoint and UI,
  release-ready versus still-waiting completed jobs are seeded and visible by
  default, and release-scheduling groundwork now exists through dashboard
  previews and admin queue filters without yet releasing funds.
- Phase 4 batch 5 completed on 2026-04-06:
  the admin orders workspace now supports intervention notes that save directly
  onto orders, and admins can inspect a dry-run release preview that explains
  the exact escrow, CBT, and platform ledger movements the future release
  engine will perform once Phase 5 begins.
- Phase 4 batch 6 completed on 2026-04-06:
  the admin dashboard and order detail views now expose a concrete
  `RELEASE_ESCROW` queue blueprint, including queue name, job id, scheduled
  time, and dry-run payload previews for ready and still-waiting release
  candidates, without yet enqueueing or executing those jobs.
- Phase 4 batch 7 completed on 2026-04-06:
  release preparation now includes a global admin audit that separates truly
  ready candidates from blocked ones, and seeded dispute data now proves the
  dashboard and scheduler preview exclude blocked orders from the ready queue
  while still surfacing them for intervention.
- The current fulfillment work still stops before dispute handling, delayed
  escrow release scheduling, and real-time CBT job updates.

---

## Phase 5 — Escrow Release & Commission Engine

**Goal:** Automatic escrow release after 2-hour window. Commission split to
platform and CBT. CBT earnings dashboard.

### Key Deliverables
- [x] Bull job processor: RELEASE_ESCROW
- [x] Atomic: release escrow → debit escrow → credit CBT → credit platform
- [x] CBT commission credited with `withdrawable: true` after 2hrs
- [x] CBT earnings history endpoint (paginated)
- [x] CBT earnings dashboard UI (service mix, lifetime totals, release-state buckets)
- [x] Admin visibility into released vs pending CBT earnings
- [x] CBT withdrawal-readiness UI (ready, awaiting, blocked release buckets)
- [x] CBT withdrawal request submission
- [x] Admin payout review workflow (approve, processing, complete, reject)
- [x] Platform commission tracking in admin analytics

### Notes
- Phase 5 batch 1 completed on 2026-04-07:
  Bull queue infrastructure now schedules `RELEASE_ESCROW` jobs from completed
  CBT work, startup recovery re-enqueues pending releases idempotently, ready
  orders are released atomically, CBT earnings now land in `availableBalance`
  after the dispute window, and platform commission is written into the live
  wallet ledger/admin finance surfaces.
- Phase 5 batch 2 completed on 2026-04-07:
  CBT centers can now access `GET /wallet/cbt/earnings`, the `/earnings` page
  now shows released totals, pending-ready and blocked payout buckets, service
  mix, and paginated commission history, and the whole view is wired directly
  to the live release engine instead of placeholder projections.
- Phase 5 batch 3 completed on 2026-04-07:
  super admins can now access `GET /wallet/admin/cbt-earnings`, `/admin/finance`
  now separates released CBT commission from ready/awaiting/blocked payout
  exposure, and `/withdraw` now shows live withdrawal readiness so CBT centers
  can see what is available now versus what is still in the release queue or
  blocked by dispute.
- Phase 5 batch 4 completed on 2026-04-07:
  CBT centers can now submit real payout requests, those requests reserve
  wallet balance immediately, and admins can review them through pending,
  approved, processing, completed, or rejected states from `/admin/finance`
  while rejected requests restore the reserved funds safely.

---

## Phase 6 — Dispute & Resolution System

**Goal:** Requesters can raise disputes within 2-hour window. Admin reviews
and resolves. CBT can be penalised or asked to redo.

### Key Deliverables
- [x] Dispute creation endpoint (requester, within dispute window only)
- [x] Dispute cancels Bull RELEASE_ESCROW job
- [x] Dispute dashboard for admin
- [x] Admin actions: resolve-for-requester | resolve-for-cbt | request-redo
- [x] Redo flow: order returns to IN_PROGRESS, CBT notified, new deadline set
- [x] Penalty: deduct from CBT available balance, create PENALTY transaction
- [x] Dispute UI for requester (raise dispute, evidence upload)
- [x] Dispute management UI for admin
- [x] Requester-favor resolution refunds locked escrow back to wallet
- [x] Requester-favor resolution can open a pending CBT penalty review entry

### Notes
- Phase 6 batch 1 completed on 2026-04-07:
  requesters can now raise live disputes from completed CBT-fulfilled orders
  while the dispute window is still open, `/disputes` now lists real cases,
  `/orders` now supports opening a dispute from the order detail pane, and the
  admin order workspace can move a dispute into review or resolve it for the
  requester or CBT center. Release preparation and queue logic now treat
  unresolved disputes as blockers while allowing `RESOLVED_FOR_CBT` orders to
  return safely to the completed/release-preparation flow.
- Phase 6 batch 2 completed on 2026-04-07:
  admin disputes now have a dedicated `/admin/disputes` queue with search,
  status filtering, metrics, and shared review controls. Admins can now issue
  `REQUEST_REDO`, which moves the order back to `IN_PROGRESS`, clears the
  previous result handoff, sets a redo deadline, and keeps release blocked.
  When the CBT uploads the corrected result, the order returns to
  `COMPLETED`, the dispute records `redoCompletedAt`, and the admin dispute
  payload now exposes refund/penalty groundwork such as escrow exposure,
  candidate CBT penalty amount, platform amount at risk, and the expected
  refund path preview.
- Phase 6 batch 3 completed on 2026-04-08:
  requester-favor resolutions now execute real wallet refunds when the order
  amount is still held in escrow, moving the order to `REFUNDED` and creating
  a `REFUND` transaction tied to the order. Admins can also opt to open a
  pending `PENALTY` review entry against the assigned CBT center without
  deducting funds yet, and the dispute/admin UI now exposes refund status,
  refund reference, penalty status, and penalty reference directly.
- Phase 6 batch 4 completed on 2026-04-08:
  admins can now complete the two remaining financial follow-up paths after a
  requester-favor dispute decision: apply the pending CBT penalty for manual
  work, or mark a released-order refund as completed through manual
  reconciliation. For runtime stability, these follow-up actions now travel
  through the existing admin dispute endpoint instead of a separate nested
  route, while the UI still presents them as distinct follow-up controls.

---

## Phase 7 — VTU Automated Services

**Goal:** Airtime, Data, Cable TV, Electricity go live. Direct API call,
instant result, no CBT involvement.

### Key Deliverables
- [x] VTU provider adapter implemented (real provider API)
- [x] VTU order flow: create order → call VTU API → return result instantly
- [x] Data plans API: live plans from provider, cached in Redis (5 min TTL)
- [x] SmartCard/meter verification endpoints
- [x] VTU result stored in order.providerResponse
- [x] VTU commission taken immediately (no dispute window)
- [x] VTU services UI: Airtime, Data, Cable TV, Electricity flows
- [x] Airtime: network selector, amount, phone number
- [x] Data: network selector, plan picker (with prices from provider)
- [x] Cable TV: provider selector, smartcard verification, plan picker
- [x] Electricity: disco selector, meter verification, amount entry, token display

### Notes
- VTU automated-service foundations completed on 2026-04-09:
  airtime and data services now bypass the manual CBT/held-funds path, create
  immediate `SERVICE_PURCHASE` ledger entries, store provider delivery payloads
  in `order.providerResponse`, and recognise platform commission immediately.
- Cable TV and electricity automated-delivery flows also completed on
  2026-04-09: the API now exposes smartcard and meter verification endpoints,
  the order modal verifies cable/electricity accounts before purchase, cable
  bouquet selection now loads from the provider-backed plan endpoint, and
  successful purchases return delivery details such as smartcard customer name,
  bouquet, meter customer details, prepaid token, and purchased units.
- Redis-backed VTU caching and provider hardening completed on 2026-04-09:
  data-plan lookups, cable-plan lookups, cable smartcard verification, and
  electricity meter verification now cache in Redis with short TTLs, degrade
  safely if cache writes fail, and return provider-mode metadata so the app can
  distinguish fresh vs cached reads and live vs mock-backed provider state.
- Real VTU transport integration and admin readiness controls completed on
  2026-04-09: Provider One now performs live HTTP requests when credentials are
  configured, retains mock fallbacks when they are not, exposes readiness and
  probe results to super admins, and surfaces provider mode/readiness metadata
  in the admin services workspace.
- The current provider adapter still returns mocked success payloads when live
  VTU credentials are not configured; the automated order path is real, while
  provider transport remains adapter-backed and environment-dependent.
- Live local verification passed on 2026-04-09 for both new automated paths:
  a seeded user completed a GOtv subscription purchase and, after reseeding,
  completed an EKEDC prepaid token purchase with provider payloads stored on
  the resulting orders.
- Live local verification also confirmed Redis caching on 2026-04-09:
  repeated VTU plan and verification requests returned `cached = false` on the
  first read and `cached = true` on the second read while still reporting the
  provider mode as `mock`.
- Live local verification also confirmed the live transport branch on
  2026-04-09 using a fake VTU server: admin readiness returned
  `mode = live` and `probe = healthy`, VTU data-plan retrieval returned live
  provider metadata, and a seeded user completed a live-branch data purchase
  with the provider payload stored on the order.
- Admin rollout controls and real external VTU credential onboarding completed
  on 2026-04-09: super admins can now persist VTU base URL, API key, header,
  prefix, rollout mode, and endpoint overrides in the database, readiness now
  reflects those saved settings, and the adapter respects forced `MOCK` /
  `LIVE` cutover without relying only on environment variables.
- Live local verification also confirmed persisted rollout control on
  2026-04-09 using a fake VTU server: readiness moved `mock -> live -> mock`,
  the live health probe succeeded against saved credentials, and a reseeded
  `cafe@test.com` account completed a live-branch `MTN Data` purchase with the
  returned provider payload stored on the order.
- Provider rollout polish completed on 2026-04-09: readiness now exposes a
  platform scope descriptor, saved validation status, and a recent validation
  history feed backed by persistent provider validation events; admins can also
  run explicit validation checks from the services workspace instead of relying
  only on passive readiness probes.
- Tenant-owned VTU provider resolution completed on 2026-04-11: provider
  lookup now resolves `TENANT -> PLATFORM`, tenant-admin endpoints exist for
  provider readiness/configuration/validation, and tenant-scoped automated
  service reads plus purchases now pass tenant context through the VTU layer.
- Tenant provider scoping hardening also completed on 2026-04-11: catalog
  visibility, VTU verification reads, automated-service cache keys, and order
  creation now respect tenant scope so one tenant cannot target another
  tenant's service/provider records.
- Live local verification also confirmed the validation-history flow on
  2026-04-09: saved rollout mode moved through `mock -> live -> mock`,
  validation history recorded both a mock and live probe, and the latest saved
  validation status persisted as `healthy` before the local rollout mode was
  returned to `MOCK` for safety.
- The VTU/provider layer is no longer purely platform-admin owned. The current
  remaining work is tenant-admin UX polish, tenant/provider lifecycle cleanup,
  and future multi-provider groundwork beyond the single VTU adapter.

---

## Phase 8 — Withdrawal System

**Goal:** CBTs can request bank withdrawals from their available balance.
Admin approves. FintavaPay processes payout.

### Key Deliverables
- [x] Withdrawal request endpoint (CBT, requires wallet PIN)
- [x] Minimum withdrawal validation (from SystemConfig)
- [x] Admin: withdrawal queue + approve/reject
- [x] FintavaPay payout API integration (initiateTransfer + getBanks in interface + all 3 providers)
- [x] Auto-initiate bank transfer on APPROVAL, advance to PROCESSING, handle immediate SUCCESS
- [x] Payout webhook handler (POST /wallet/webhooks/payout) — confirms COMPLETED or reverses on failure
- [x] Withdrawal status tracking + CBT notification
- [x] Withdrawal history UI (CBT)
- [x] Admin withdrawal management UI
- [x] Bank list endpoint (GET /wallet/banks) + dropdown in WithdrawalRequestForm

---

## Phase 9 — Real-time & Push Notifications

**Goal:** WebSocket events for live job pool updates. PWA push notifications.
In-app notification center.

### Key Deliverables
- [x] Socket.io server configured with JWT auth on connection
- [x] User rooms: `user:{userId}`, `cbt:pool`
- [x] Core realtime events live: `notification:new`, `wallet:updated`, `job:new`
- [x] Remaining explicit realtime events: `job:claimed`, `order:completed`
- [x] Notification center UI (bell icon, unread count badge, list)
- [x] Mark as read / mark all as read
- [x] Notification creation on major business events (orders, disputes, withdrawals, wallet movement)
- [ ] Notification coverage audit for any remaining approval/review edge cases
- [x] Browser push subscription persistence (service worker + API)
- [x] Push notification sent on key events (server-side)
- [x] Email notifications: order confirmed, result ready, dispute update
- [x] SMS notifications: OTP and key order updates

### Notes
- Phase 9 is no longer a future-only phase. The codebase already contains a
  live notifications module, websocket gateway, authenticated socket client,
  unread badge, notifications inbox, and read-state mutations.
- Backend realtime/notification foundation currently lives in:
  `apps/api/src/modules/notifications/*`, with event emission also wired from
  `orders.service.ts`, `orders-release-queue.service.ts`, and
  `wallet.service.ts`.
- Frontend notification/realtime foundation currently lives in:
  `apps/web/src/app/socket-bootstrap.tsx`,
  `apps/web/src/lib/socket-client.ts`,
  `apps/web/src/hooks/use-notifications.ts`, and
  `apps/web/src/app/notifications/page.tsx`.
- Explicit named realtime event coverage was extended on 2026-04-11:
  `job:claimed` now updates CBT pool/my-jobs state, and `order:completed`
  now updates requester/CBT order state on top of the existing generic
  notification stream.
- Email delivery for Phase 9 core moments was also completed on 2026-04-11:
  order confirmation, result-ready updates, dispute updates, and withdrawal
  decision emails now flow through the existing email PAL with safe fallback
  behavior when live credentials are absent.
- Browser push subscription persistence and server-triggered push delivery were
  added on 2026-04-11 through:
  `apps/api/src/modules/notifications/push-delivery.service.ts`,
  the new push-subscription API endpoints, the browser push worker at
  `apps/web/public/push-sw.js`, and the subscription controls/hooks in the web
  notifications workspace.
- The current push implementation depends on configured VAPID keys in env.
  Without them, in-app realtime notifications still work, but background web
  push remains disabled.
- What remains in this phase is now the live VAPID-backed browser verification
  pass plus SMS/coverage audit beyond OTP.

---

## Phase 10 — Admin Analytics, Security Audit & Launch

**Goal:** Full admin analytics dashboard. Security hardened. Performance
optimized. Production deployed.

### Key Deliverables
- [x] Admin: platform revenue dashboard (daily/weekly/monthly charts)
- [x] Admin: orders by service type (bar chart)
- [x] Admin: CBT performance metrics (jobs completed, dispute rate, top performers)
- [x] Admin: user growth chart (new + cumulative)
- [x] Admin: wallet float overview (escrowed, platform, CBT, user balances)
- [x] Admin: export reports (CSV — orders + transactions via GET /analytics/admin/export/*)
- [x] Admin: system config management (dispute window, withdrawal limits, commission rates)
- [x] Offline mode (service worker caches service catalog, order history, wallet, profile)
- [ ] Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1 (needs production deploy to measure)
- [x] Security headers verified (CSP, HSTS, X-Frame-Options, Permissions-Policy all set)
- [x] pnpm audit: zero critical vulnerabilities (9 remaining highs are transitive build-tool deps, not runtime-reachable)
- [ ] Load testing: simulate 500 concurrent users
- [ ] Sentry frontend App Router hardening (missing `global-error` handler, `onRequestError` hook, and `instrumentation-client` migration still produce build warnings)
- [ ] UptimeRobot (or equivalent) health monitoring
- [ ] Production PostgreSQL with daily backups
- [ ] Production Redis with persistence configured
- [x] Vercel deployment (frontend — live at www.zendocx.net)
- [x] Fly.io deployment (backend — live at api.zendocx.net, 43 secrets deployed)
- [x] Cloudflare DNS + WAF configured (api → Fly, www/root → Vercel)
- [x] All .env secrets moved to platform secret manager (fly secrets)
- [x] VAPID keys set (WEB_PUSH_VAPID_PUBLIC_KEY + WEB_PUSH_VAPID_PRIVATE_KEY + WEB_PUSH_VAPID_SUBJECT set on Fly)
- [x] Signed Cloudinary URLs for result files (Cloudinary provider rewired to type:"authenticated" + getSignedUrl)
- [x] Sentry error monitoring configured (API: @sentry/nestjs in main.ts + http-exception.filter; Web: sentry.*.config.ts + instrumentation.ts + withSentryConfig)
- [x] UptimeRobot health monitoring (confirmed set up via screenshot)
- [x] SaaS marketing landing page at zendocx.net/www.zendocx.net (proxy.ts + page.tsx + landing-page.tsx)
- [x] CI pnpm version fix (removed hardcoded version: 9 from ci.yml; bumped Node 20 → 22)
- [x] Vercel build fix — admin layout RSC boundary (added 'use client' to (admin)/layout.tsx)
- [x] Email system fully wired — Resend real SDK, OTP + password reset emails with branded HTML templates
- [x] Resend domain verified (zendocx.net — DKIM, SPF MX+TXT, DMARC added in Cloudflare)
- [x] RESEND_API_KEY + FRONTEND_URL set on Fly.io
- [x] Tenant-scoped email routing (resolveTenantSender helper in auth/orders/wallet services)
- [x] Tenant admin welcome email on account creation (TenantService)
- [x] Platform login routing fix — /forgot-password and /reset-password now return to /platform/login for super admin (no tenant slug context)
- [x] Dashboard and pages redesigned (StatCard, Sidebar icons, TenantPortalHome, admin services 3-tab)
- [x] Workspace verification pass green (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`)
- [x] All dashboards redesigned — DashTile grid + DetailModal pattern (individual, CBT, tenant admin, super admin, wallet, business workspace)
- [x] CBT registration fully operational — serviceCategoryIds removed from schema, deployed
- [x] CBT dashboard fixed for PENDING/REJECTED centers — returns status data instead of 403
- [x] Tenant admin CBT management page rewritten — uses useAdminCbtApplications, full approve/reject/category-assign workflow, approval status badges, PageHero
- [x] Hydration refactor — shared useHydrated hook replaces repeated useState/useEffect mount guard across all layouts
- [x] Admin CBT detail modal button layout fixed — removed flex-1 from Approve/Reject buttons
- [x] Wallet Paystack live payment redirect fixed — removed checkout=sandbox guard; POST /wallet/fund/confirm now fires for both sandbox and live redirects
- [x] CBT job visibility fixed — buildSupportedCbtCategoryWhere([]) now returns {} instead of { in: [] } (which matched nothing in Prisma)
- [x] Super admin CBT Centers nav removed — approval is tenant admin responsibility; /admin/cbt redirects to /admin/dashboard
- [x] Wallet history sheet on home page — "History" button opens chooser sheet → /wallet?panel=report or /wallet?panel=history
- [x] AccountPanel/ScrollCardBody scroll chain fixed at xl breakpoint; md:overflow-hidden → xl:overflow-hidden across all dashboard pages
- [x] Support page quick-actions 3-col grid at lg breakpoint (was xl)
- [x] Services visibility fix — new platform services auto-included for tenants with custom selection (lastSelectionSavedAt logic)
- [x] Fund wallet modal fully redesigned — bottom sheet pattern, quick-select chips, navy result card
- [x] Services page accordion default-closed + URL ?categorySlug deep link from home page category tiles
- [ ] Confirm password reset email delivery in production (run fly logs --app zentry-api-prod)
- [ ] Sentry Vercel env vars still needed: NEXT_PUBLIC_SENTRY_DSN, SENTRY_ORG=zendocx, SENTRY_PROJECT=zendocx-web
- [ ] app.zendocx.net CNAME record in Cloudflare (add app → cname.vercel-dns.com)
- [ ] Paystack webhook production truth pass — verify PAYSTACK_WEBHOOK_SECRET on Fly matches Paystack dashboard secret exactly
- [ ] Manual browser verification: silent refresh on 401 and PWA install flow
- [ ] Load testing: simulate 500 concurrent users
- [ ] Launch checklist signed off

---

## What Is Intentionally NOT Built (Out of Scope)

- No mobile native app (iOS/Android) — PWA only
- No tenant-managed BYO provider rollout beyond the current VTU readiness and
  scoped configuration work. Tenant-owned non-VTU providers, broad tenant-owned
  NIN delivery, and custom-domain-grade provider expansion remain later work.
- No chat/messaging between users — only notifications
- No subscription model — pay-per-service only
- No multi-currency — NGN only
- No referral system (may be added post-launch)
- No public API / third-party developer access
- No full custom-domain white-label rollout yet. Multi-tenancy, tenant admin,
  tenant-scoped auth/data isolation, and tenant-owned VTU readiness are now
  active implementation tracks, but custom domains, billing plans, and broader
  tenant-owned provider categories remain later work.
