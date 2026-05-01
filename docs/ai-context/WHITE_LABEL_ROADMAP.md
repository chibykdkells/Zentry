# WHITE_LABEL_ROADMAP.md — Multi-Tenant White-Label Expansion

> Last updated: 2026-04-11
> Status: Active re-architecture in progress
> Target window: Multi-tenancy closeout during current platform hardening

---

## Purpose

This document defines the platform-first white-label expansion for ZenDocx.

The goal is for ZenDocx to operate as the infrastructure platform while tenant
businesses run branded service portals on top of it. That includes the launch
business itself: the first live operating business must be modeled as a normal
tenant, not a special-case app hardcoded into the platform.

This is a true multi-tenant SaaS expansion, not a cosmetic branding feature.

The roadmap below is no longer purely speculative. The codebase already has:
- tenant-aware request resolution and local-dev tenant fallback
- tenant-scoped registration/login/runtime verification
- tenant admin routes and APIs
- tenant-scoped catalog, order, wallet, dispute, and withdrawal flows
- tenant-owned VTU readiness/configuration with platform fallback

What remains is the rest of the closeout and the later-stage commercial/domain
features.

---

## Product Model

### What white-label means in ZenDocx

Each white-label customer becomes a tenant with:
- isolated staff, customers, orders, wallets, disputes, support, and reports
- tenant-owned branding, public storefront, and dashboard
- tenant-owned customer relationship
- a tenant mini-admin for operations and branding

ZenDocx remains the platform owner and controls:
- subscriptions for white-label plans
- withdrawal charges
- optional commission or revenue-share partnerships
- tenant approval, suspension, oversight, and platform-wide reporting
- core auth, wallet infrastructure, audit, provider orchestration, and security

### Platform-first rule

ZenDocx should be treated as the infrastructure company, not the permanent
customer-facing business brand.

That means the future model is:
- one platform layer operated by ZenDocx
- one first-party tenant used to launch and test the software in production
- many future third-party tenants using the same tenant architecture

The first-party tenant must operate under the same tenant architecture,
capabilities, and restrictions as any other tenant.

### Commercial model

- Free plan: `brand.zendocx.net`
- Paid plan: custom domain support such as `portal.theirbrand.com`
- ZenDocx may charge:
  - subscription fees
  - withdrawal fees
  - negotiated commission partnerships on tenant earnings

---

## Confirmed Scope Decisions

### Tenant isolation

- Each tenant has its own isolated users, staff, orders, wallet views, disputes,
  support workflows, reports, branding, and service settings.
- Tenant users exist only inside that tenant's branded portal.
- Tenant users do not log into the main ZenDocx consumer portal.
- ZenDocx platform admins can see all tenants and all tenant data from the
  platform dashboard, subject to platform permissions and audit logging.
- The launch business is also a tenant and must follow the same isolation model.

### Domain strategy

- Free white-label plan uses subdomains: `brand.zendocx.net`
- Paid white-label plan supports custom domains
- Reserved ZenDocx domains and routes must never be claimable by tenants
- The first-party launch tenant should also be served through the tenant-domain
  model eventually, even if a temporary direct-platform frontend exists during
  migration.

### Wallet and settlement model

ZenDocx will use a hybrid model:
- each tenant sees its own isolated wallet and business ledger
- the underlying settlement and platform controls remain managed by ZenDocx
- ZenDocx can enforce subscriptions, withdrawal charges, and commission
  partnerships while preserving tenant-facing isolation

### Provider strategy

White-label rollout will happen in stages:

1. Current implemented state:
   - platform-managed delivery still works as the default
   - tenant-owned VTU readiness/configuration is now implemented with
     `TENANT -> PLATFORM` fallback
2. Next later release:
   - broaden tenant-managed delivery from VTU readiness/config into fully
     owned operational rollout where the business model supports it
   - add tenant-managed `NIN` only if the product still needs it
3. Later expansion:
   - extend tenant-managed providers to other categories only if needed

This means provider resolution is already tenant-aware, but broader tenant-owned
provider rollout is still intentionally narrow.

---

## Tenant Roles

### Platform-level roles

- `SUPER_ADMIN` or future platform roles manage all tenants
- platform roles are not tenant-scoped
- platform roles can approve tenants, review reports, manage billing, and audit
  cross-tenant activity

### Tenant-level roles

Recommended tenant-scoped role model:
- `TENANT_OWNER`
- `TENANT_ADMIN`
- `TENANT_STAFF`
- `TENANT_CUSTOMER`

Notes:
- The current Phase 1 role model can remain during stabilization.
- The launch business should eventually be remapped into the tenant model rather
  than preserved as a permanent special-case direct-consumer surface.
- Role migration for multi-tenancy should happen in a dedicated expansion phase,
  not mixed into core Phase 1 stabilization work.

---

## Architecture Direction

### Tenancy model

Adopt a single shared application with logical tenant isolation.

Each request must resolve one of:
- platform context
- tenant context

Tenant context should be derived from:
- subdomain
- custom domain
- explicit platform-managed tenant admin routes where needed

### Request resolution

At request start, the platform should resolve:
- which host was requested
- whether the request is for ZenDocx platform or a tenant portal
- which tenant is active
- which branding, provider rules, and permissions apply

In the steady-state model:
- tenant customer traffic should resolve into tenant context
- tenant staff/admin traffic should resolve into tenant context
- only platform admin and platform-operations traffic should resolve into pure
  platform context

### Isolation rule

Every tenant-owned resource must be scoped by `tenantId`.

Examples:
- users
- staff memberships
- customer profiles
- wallets
- transactions
- orders
- disputes
- notifications
- reports
- branding settings
- provider settings

Platform resources remain global and are not tenant-owned.

---

## Database Impact

### New core entities

Expected additions:
- `Tenant`
- `TenantDomain`
- `TenantBranding`
- `TenantSubscription`
- `TenantProviderConfig`
- `TenantMembership`
- `TenantServiceConfig`
- `TenantSettlementConfig`

Potential later additions:
- `TenantReportSnapshot`
- `TenantWebhookEndpoint`
- `TenantBillingInvoice`

### Existing entity changes

Most business entities will eventually require `tenantId`, including:
- `User`
- `Wallet`
- `Transaction`
- `Order`
- `Dispute`
- `Notification`
- `AuditLog`

Recommended direction:
- platform-owned actors keep `tenantId = null`
- tenant-owned actors and records use a non-null `tenantId`
- the first-party launch business should also use a real `tenantId`

### Uniqueness rules

Move from globally unique customer identifiers to tenant-aware uniqueness where
appropriate, for example:
- unique email per tenant
- unique phone per tenant
- unique tenant subdomain globally
- unique custom domain globally

Platform admins and system-owned records still require global uniqueness.

### Migration caution

Do not bolt tenancy onto every table in one rushed migration.

Recommended sequence:
1. introduce tenant tables and nullable `tenantId`
2. backfill direct ZenDocx records carefully
3. add tenant-aware indexes and constraints
4. only then enforce stricter non-null tenant rules where appropriate

---

## Frontend Impact

### Public storefronts

The frontend must eventually support:
- ZenDocx platform marketing and platform-admin flows
- tenant-branded storefronts resolved by host
- tenant-specific login, registration, dashboard, support, and branding

Recommended steady-state frontend shape:
- platform marketing and platform admin surface
- first-party tenant storefront
- third-party tenant storefronts

### Branding surface

Each tenant should be able to manage:
- logo
- banner or hero image
- primary brand color
- neutral support colors
- business name
- support contact details
- visible service categories

Brand tokens should be loaded dynamically per tenant, but the base design system
must stay structurally consistent to avoid quality drift.

### PWA continuity

PWA support is a first-class architecture constraint, not a later enhancement.

The white-label rollout must preserve:
- installability
- manifest generation strategy
- service worker behavior
- app-shell caching rules
- offline-safe boundaries
- tenant-aware icons, names, and theme colors where appropriate

No tenant architecture decision should quietly break the PWA model.

### Dashboard layers

Separate dashboard experiences will eventually exist for:
- ZenDocx platform admin
- tenant mini-admin
- tenant staff
- tenant customers

---

## Backend Impact

### Auth and session rules

Authentication must become tenant-aware.

Requirements:
- tenant users can authenticate only inside their tenant portal
- platform admins authenticate into the ZenDocx platform
- tenant-aware cookie/session and refresh flows must resolve the tenant context
- audit logs must include tenant context when present
- the first-party tenant must use the tenant-aware auth path just like any other
  tenant

### Authorization

Authorization must validate:
- platform scope vs tenant scope
- actor role
- actor membership in the active tenant
- service/category permissions where applicable

### Provider resolution

Provider calls should resolve in this order:
1. current tenant
2. service category
3. provider ownership mode
4. active credentials
5. platform fallback if allowed

Ownership modes:
- `platform-managed`
- `tenant-managed`

Current implementation keeps most providers platform-managed while allowing
tenant-scoped VTU readiness/configuration and tenant-first resolution. Broader
tenant-managed rollout remains later work.

### Support and dispute workflows

Support, disputes, and reports must become tenant-aware.

Principles:
- tenant teams manage first-line customer operations
- ZenDocx platform admin manages escalation, oversight, billing disputes, and
  platform exceptions

### Security baseline

Security must remain part of the design from the start of the expansion.

Non-negotiable future requirements:
- strict tenant data isolation at query and authorization layers
- encrypted tenant secrets and provider credentials at rest
- audit logs with tenant context
- rate limiting and abuse controls across platform and tenant surfaces
- safe domain verification and domain takeover protections
- tenant-aware session and cookie handling
- platform-level visibility without tenant data leakage
- PWA and service-worker behavior reviewed for cache isolation and sensitive data

---

## Billing and Settlement Model

### Hybrid tenant wallet model

The tenant sees:
- isolated tenant balance
- earnings summaries
- withdrawal history
- order-linked inflows

The platform controls:
- the actual ledger engine
- subscription billing
- withdrawal charges
- revenue-share calculations
- exception handling and audit

### Recommended financial layers

- customer wallet or payment intent layer
- tenant ledger layer
- ZenDocx platform fee layer
- settlement and withdrawal layer

This gives tenant isolation without giving up platform control.

---

## Custom Domain Model

### Free plan

- subdomain provisioning only
- generated and reserved through the platform

### Paid plan

- custom domain onboarding
- domain verification flow
- DNS instructions
- SSL/TLS provisioning
- domain status checks and rollback rules

### Operational rules

- tenant domain mapping must be reversible
- suspended tenants must stop serving their custom domain safely
- domain claims must be audited

---

## Phased Implementation Roadmap

### Stage 0 — Core stabilization first

This stage is materially complete enough for active tenant work. The codebase
already crossed the original “do not begin” threshold:
- core auth, wallet, order, provider, and notification foundations exist
- tenant-aware request resolution and registration are live
- PWA/security constraints are already being carried into the tenant shape

### Stage 1 — Tenancy foundation

Build:
- `Tenant` domain model
- tenant-aware request resolution
- `tenantId` scaffolding on core entities
- platform vs tenant authorization strategy
- tenant branding storage model
- first-party tenant model for the launch business

Also define in this stage:
- PWA tenant-branding strategy
- tenant-aware security and audit baseline

Current state:
- Stage 1 is largely implemented
- custom domains are now partially implemented: storage, safe host resolution,
  and tenant-admin DNS TXT verification exist, but full onboarding, DNS
  automation, and production domain operations are still later work
- tenant-owned provider expansion is only partially implemented through VTU
  readiness/configuration and fallback-aware resolution

### Stage 2 — Tenant admin and branded subdomain launch

Build:
- tenant onboarding
- tenant mini-admin
- subdomain-based storefronts
- first-party tenant storefront on the same tenant model
- branding controls
- isolated tenant users/staff dashboards
- tenant service visibility and tenant pricing controls

Current state:
- tenant mini-admin, subdomain/local tenant context, branding/settings shape,
  and isolated tenant users are already underway
- providers are no longer purely ZenDocx-managed because VTU now supports
  tenant-scoped readiness/configuration and tenant-first resolution

### Stage 3 — Tenant operations depth

Build:
- tenant-scoped orders
- tenant-scoped support and disputes
- tenant reports
- tenant staff management
- tenant wallet/ledger visibility
- platform oversight dashboards for all tenants

### Stage 4 — Billing and custom domains

Build:
- white-label subscription billing
- withdrawal fee controls
- optional commission-partnership configuration
- custom domain onboarding and verification

### Stage 5 — Tenant-managed provider support for VTU and NIN

Build:
- encrypted tenant provider credentials
- provider ownership mode resolution
- tenant-managed VTU provider support
- tenant-managed NIN provider support
- audit and operational support around tenant-owned integrations

Current state:
- encrypted tenant provider credentials and tenant-managed VTU readiness are in
- provider ownership/fallback resolution for VTU is in
- broader tenant-managed VTU operations, NIN provider support, and commercial
  rollout controls remain later work

### Stage 6 — Expand only if justified

Possible later work:
- more tenant-managed provider categories
- deeper tenant theming controls
- tenant-level automations and webhooks
- partner analytics and settlement exports

---

## What Still Stays Out of Scope For The Current Closeout

The following are still later work even though the multi-tenant re-architecture
itself is already active:
- custom-domain routing and domain verification
- tenant billing plans and white-label subscription management
- broader tenant-owned provider categories beyond the current VTU scope
- full tenant-managed NIN rollout
- deeper tenant theming/webhook/partner automation layers

Do not preserve a permanent direct-business shortcut outside the tenant model.

---

## Open Implementation Questions

These are not blockers for the roadmap, but they must be answered before coding:
- exact tenant billing plans and feature gates
- commission formulas for partnership tenants
- how tenant support escalates to ZenDocx ops
- whether a tenant can operate multiple storefront brands under one account
- whether direct ZenDocx consumer accounts and tenant customer accounts can ever
  be merged in the future
- compliance and data-retention requirements for tenant-owned customer data

---

## Recommended Next Step

Use this document as the live-state expansion reference.

The next product work should keep finishing the current multi-tenancy closeout:
- tenant-admin provider UX and readiness lifecycle polish
- remaining platform-vs-tenant boundary tightening
- final tenant-scoped query audits
- doc/runtime reconciliation as the live architecture settles

After that, the next major white-label steps are:
- domain provisioning flows
- billing/commercial controls
- broader tenant-owned provider rollout only where justified
