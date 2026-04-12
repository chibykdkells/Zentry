# ARCHITECTURE.md — Zentry System Architecture

> Last updated: 2026-04-11
> Read this before touching any folder structure, adding a module, or
> introducing a new dependency.

---

## System Overview

Zentry is a **pnpm monorepo** managed by **Turborepo**. It contains two
applications and three shared packages. Every external integration (payments,
VTU, SMS, email, storage) is abstracted behind a provider interface — this
is the **Provider Abstraction Layer (PAL)**.

Current implementation is now in active migration away from the old direct-platform structure.
The expansion direction is platform-first multi-tenancy, and this is already in
flight in the live codebase:
- Zentry becomes the infrastructure/platform layer
- the launch business becomes the first-party tenant
- future external businesses become additional tenants
- platform admin remains above all tenants

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (PWA)                         │
│              Next.js 16 — Mobile-first — Installable        │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS REST + WebSocket
┌────────────────────────▼────────────────────────────────────┐
│                     API (NestJS)                            │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Auth Module  │  │ Order Module │  │ Services Module  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │Wallet Module │  │Tenant Module │  │Notifications Mod │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           PROVIDER ABSTRACTION LAYER (PAL)          │   │
│  │  Payment | VTU | SMS | Email | Storage              │   │
│  └─────────────────────────────────────────────────────┘   │
└──────┬─────────────────────────┬───────────────────────────┘
       │                         │
┌──────▼──────┐         ┌────────▼────────┐
│ PostgreSQL  │         │  Redis          │
│ (Prisma)    │         │  Bull Queue     │
│ All money   │         │  Sessions       │
│ in KOBO     │         │  Escrow timers  │
└─────────────┘         └─────────────────┘
```

---

## Monorepo Structure

```
zentry/
├── apps/
│   ├── web/                          # Next.js 16 PWA
│   │   ├── public/
│   │   │   ├── manifest.json
│   │   │   └── icons/
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx
│   │       │   ├── (auth)/           # Login, Register, Verify, Reset
│   │       │   ├── (dashboard)/      # Individual requester views
│   │       │   ├── (cbt)/            # CBT Center views
│   │       │   ├── (tenant-admin)/   # Tenant admin views
│   │       │   └── (admin)/          # Super Admin views
│   │       ├── components/
│   │       │   ├── layout/           # Sidebar, BottomNav, TopBar, MoreSheet
│   │       │   ├── auth/
│   │       │   ├── wallet/
│   │       │   ├── orders/
│   │       │   ├── notifications/
│   │       │   └── shared/           # EmptyState, Skeleton, StatCard
│   │       ├── hooks/
│   │       ├── lib/
│   │       │   ├── api-client.ts     # Axios + interceptors
│   │       │   └── query-client.ts
│   │       ├── stores/               # Zustand stores
│   │       └── styles/
│   │
│   └── api/                          # NestJS
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts
│       └── src/
│           ├── main.ts
│           ├── app.module.ts
│           ├── config/
│           ├── common/
│           │   ├── decorators/       # @CurrentUser, @Public, @Roles
│           │   ├── guards/           # JwtAuthGuard (global), RolesGuard
│           │   ├── filters/          # HttpExceptionFilter
│           │   ├── interceptors/     # TransformInterceptor, AuditLogInterceptor
│           │   ├── pipes/            # ZodValidationPipe
│           │   └── utils/
│           ├── providers/            # PAL — ALL external API adapters live here
│           │   ├── interfaces/       # IPaymentProvider, IVtuProvider, etc.
│           │   ├── payment/          # FintavaPay, Paystack, Flutterwave adapters
│           │   ├── vtu/              # VTU provider adapters
│           │   ├── sms/              # Termii adapter
│           │   ├── email/            # Resend adapter
│           │   └── storage/          # Cloudinary adapter
│           └── modules/
│               ├── auth/
│               ├── notifications/
│               ├── orders/
│               ├── prisma/
│               ├── redis/
│               ├── services/
│               ├── tenant/
│               ├── users/
│               └── wallet/
│
├── packages/
│   ├── types/                        # Shared enums and TypeScript interfaces
│   │   └── src/
│   │       ├── enums.ts
│   │       ├── user.types.ts
│   │       ├── order.types.ts
│   │       └── index.ts
│   ├── utils/                        # Pure shared utility functions
│   │   └── src/
│   │       ├── kobo.ts               # nairaToKobo(), koboToNaira()
│   │       ├── reference.ts          # generateOrderNumber(), generateRef()
│   │       └── index.ts
│   └── validators/                   # Shared Zod schemas
│       └── src/
│           ├── auth.schema.ts
│           ├── order.schema.ts
│           └── index.ts
│
├── docs/
│   └── ai-context/                   # AI assistant context files
├── CLAUDE.md
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Frontend Architecture (apps/web)

### Current vs Future Model

Current frontend:
- one requester surface for `INDIVIDUAL`
- one CBT surface for `CBT_CENTER`
- one tenant-admin surface for `TENANT_ADMIN`
- one platform-admin surface for `SUPER_ADMIN`

Future platform-first model:
- platform marketing and platform-admin surface
- first-party tenant storefront
- third-party tenant storefronts

The first-party tenant must eventually use the same tenant architecture as every
other tenant instead of remaining a privileged special-case frontend.

### Route Groups

| Group | Path Pattern | Who Sees It |
|---|---|---|
| `(auth)` | `/login`, `/register`, `/register/cbt`, etc. | Unauthenticated only |
| `(dashboard)` | `/home`, `/services/*`, `/orders`, `/wallet`, `/profile` | INDIVIDUAL |
| `(cbt)` | `/dashboard`, `/job-pool`, `/earnings`, `/withdraw` | CBT_CENTER |
| `(tenant-admin)` | `/tenant/*` | TENANT_ADMIN |
| `(admin)` | `/admin/*` | SUPER_ADMIN |

Route groups are enforced by the Next.js proxy layer (`proxy.ts`) that reads the JWT
role claim and redirects accordingly.

### Mobile Navigation (Bottom Nav)

- Fixed to bottom, 64px height, backdrop blur, border-top
- Hidden on `md:` breakpoint and above (desktop uses sidebar)
- Max 5 items: 4 core + "More" trigger
- "More" opens a Framer Motion slide-up sheet (AnimatePresence)
- Safe area inset on iOS: `pb-[env(safe-area-inset-bottom)]`

**Individual tabs:** Home | Services | Orders | Wallet | More
**CBT tabs:** Home | Job Pool | My Jobs | Earnings | More
**Tenant-admin tabs:** Home | Users | Settings | Profile | More
**Admin tabs:** Dashboard | Orders | Users | Finance | More

Desktop tenant-admin navigation is broader than the mobile nav and currently
includes tenant dashboard, users, CBT centers, services, providers, and
settings.

### State Management

- **Zustand:** Auth state (user, token), notification unread count, UI state
- **TanStack Query:** All server data — orders, wallet, job pool, etc.
- **No Redux.** No Context API for server data.
- Shared UI primitives currently live in repo-native components rather than a
  shadcn/ui-generated layer.

### API Client

Single Axios instance (`lib/api-client.ts`):
- Attaches `Authorization: Bearer {accessToken}` from Zustand store
- On 401: silent refresh via `/auth/refresh` (uses httpOnly cookie)
- On refresh failure: clears auth, redirects to `/login`
- `withCredentials: true` always

---

## Backend Architecture (apps/api)

### Current Direction

The backend is no longer purely Phase 1 single-platform oriented. The live
system already includes:
- tenant-aware host and local-dev tenant resolution
- tenant-scoped auth and registration flows
- tenant-admin endpoints and `/tenant/*` frontend routes
- tenant-aware catalog, order, wallet, notification, and provider behavior
- tenant-owned VTU readiness/configuration with `TENANT -> PLATFORM` fallback

What remains is closeout work rather than initial scaffolding:
- final tenant-scoped query audits
- last platform-vs-tenant boundary tightening
- tenant-admin/provider UX refinement
- later custom-domain and broader tenant-owned provider expansion

See `docs/ai-context/WHITE_LABEL_ROADMAP.md` for the live expansion direction.

### Module Dependency Order

```
AppModule
├── ConfigModule (global)
├── PrismaModule (global)
├── RedisModule (global)
├── ProvidersModule (global) ← PAL lives here
│   ├── PaymentModule
│   ├── VtuModule
│   ├── SmsModule
│   ├── EmailModule
│   └── StorageModule
└── Feature Modules
    ├── AuthModule
    ├── NotificationsModule
    ├── OrdersModule
    ├── ServicesModule
    ├── TenantModule
    ├── UsersModule
    ├── WalletModule
```

### Global Guards (applied to entire app)

1. `JwtAuthGuard` — validates access token on every request
2. `ThrottlerGuard` — rate limits per IP
3. Routes decorated with `@Public()` skip JWT check

### Standard API Response Shape

Every endpoint returns this exact shape — no exceptions:

```typescript
{
  success: boolean;
  message: string;
  data: T | null;
  meta?: {           // for paginated responses only
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  timestamp: string; // ISO 8601 UTC
}
```

Implemented in `TransformInterceptor`.

### Escrow Engine

Escrow is managed by Bull queue jobs (Redis-backed):

```
Order created
    → funds locked (DB atomic transaction)
    → Bull job scheduled: RELEASE_ESCROW (delay: 2 hours)

If dispute raised within 2hrs:
    → Bull job CANCELLED
    → Dispute flow takes over

If no dispute after 2hrs:
    → Bull job fires
    → DB atomic: release escrow → credit CBT wallet → credit platform wallet
    → CBT notified: earnings available
```

**Critical:** The client NEVER triggers escrow release. Only the Bull queue does.

### WebSocket Events (Socket.io)

| Event | Direction | Who Receives |
|---|---|---|
| `job:new` | Server → Client | CBT_CENTER (all connected) |
| `job:claimed` | Server → Client | CBT_CENTER (remove from pool) |
| `order:completed` | Server → Client | Order requester |
| `order:disputed` | Server → Client | Assigned CBT |
| `notification:new` | Server → Client | Specific user |
| `wallet:updated` | Server → Client | Specific user |

Rooms: each authenticated user joins room `user:{userId}`.
CBTs also join room `cbt:pool` for job broadcast events.

---

## Service Fulfillment Types

### MANUAL (CBT Pool)
JAMB, NIMC, NECO services — a human CBT fulfills these.

```
Order created → job enters pool → CBT claims → CBT works → CBT uploads result
→ 2hr window → auto-release escrow
```

### AUTOMATED (VTU API)
Airtime, Data, Cable TV, Electricity — direct API call.

```
Order created → funds deducted → VTU provider API called → result returned instantly
→ no CBT involved → no dispute window → platform commission taken immediately
```

---

## Commission Model

For every service, the admin configures:

```
providerCost  = what we pay the VTU/API provider (in KOBO)
platformFee   = our markup / commission (in KOBO)
cbtCommission = what the CBT earns per job (in KOBO, MANUAL only)
totalPrice    = providerCost + platformFee (what user pays)
```

These are **set in the database by admin**. If provider cost changes or we
switch providers, admin updates `providerCost`. Business logic does not
hardcode any amounts.

---

## Environment Strategy

- All secrets in `.env` files (never committed)
- `.env.example` committed with all keys listed but no values
- Active provider selected via `ACTIVE_PAYMENT_PROVIDER`, `ACTIVE_VTU_PROVIDER`, etc.
- Switching providers = change env var + ensure adapter is registered. Zero code change.
