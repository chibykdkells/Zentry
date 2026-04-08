# WHITE_LABEL_ROADMAP.md — Multi-Tenant White-Label Expansion

> Last updated: 2026-04-06
> Status: Planned future expansion
> Target window: Phase 2 / Phase 3 after core Zentry stabilization

---

## Purpose

This document defines the future platform-first white-label expansion for
Zentry.

The goal is for Zentry to operate as the infrastructure platform while tenant
businesses run branded service portals on top of it. That includes the launch
business itself: the first live operating business must be modeled as a normal
tenant, not a special-case app hardcoded into the platform.

This is a true multi-tenant SaaS expansion, not a cosmetic branding feature.

---

## Product Model

### What white-label means in Zentry

Each white-label customer becomes a tenant with:
- isolated staff, customers, orders, wallets, disputes, support, and reports
- tenant-owned branding, public storefront, and dashboard
- tenant-owned customer relationship
- a tenant mini-admin for operations and branding

Zentry remains the platform owner and controls:
- subscriptions for white-label plans
- withdrawal charges
- optional commission or revenue-share partnerships
- tenant approval, suspension, oversight, and platform-wide reporting
- core auth, wallet infrastructure, audit, provider orchestration, and security

### Platform-first rule

Zentry should be treated as the infrastructure company, not the permanent
customer-facing business brand.

That means the future model is:
- one platform layer operated by Zentry
- one first-party tenant used to launch and test the software in production
- many future third-party tenants using the same tenant architecture

The first-party tenant must operate under the same tenant architecture,
capabilities, and restrictions as any other tenant.

### Commercial model

- Free plan: `brand.zentry.ng`
- Paid plan: custom domain support such as `portal.theirbrand.com`
- Zentry may charge:
  - subscription fees
  - withdrawal fees
  - negotiated commission partnerships on tenant earnings

---

## Confirmed Scope Decisions

### Tenant isolation

- Each tenant has its own isolated users, staff, orders, wallet views, disputes,
  support workflows, reports, branding, and service settings.
- Tenant users exist only inside that tenant's branded portal.
- Tenant users do not log into the main Zentry consumer portal.
- Zentry platform admins can see all tenants and all tenant data from the
  platform dashboard, subject to platform permissions and audit logging.
- The launch business is also a tenant and must follow the same isolation model.

### Domain strategy

- Free white-label plan uses subdomains: `brand.zentry.ng`
- Paid white-label plan supports custom domains
- Reserved Zentry domains and routes must never be claimable by tenants
- The first-party launch tenant should also be served through the tenant-domain
  model eventually, even if a temporary direct-platform frontend exists during
  migration.

### Wallet and settlement model

Zentry will use a hybrid model:
- each tenant sees its own isolated wallet and business ledger
- the underlying settlement and platform controls remain managed by Zentry
- Zentry can enforce subscriptions, withdrawal charges, and commission
  partnerships while preserving tenant-facing isolation

### Provider strategy

White-label rollout will happen in stages:

1. First release:
   - white-label tenants use Zentry-managed providers only
2. Later release:
   - tenants may bring their own providers for `VTU` and `NIN` services only
3. Later expansion:
   - extend tenant-managed providers to other categories only if needed

This means provider resolution must be tenant-aware from the beginning even
though tenant-supplied credentials are initially disabled.

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
- whether the request is for Zentry platform or a tenant portal
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
2. backfill direct Zentry records carefully
3. add tenant-aware indexes and constraints
4. only then enforce stricter non-null tenant rules where appropriate

---

## Frontend Impact

### Public storefronts

The frontend must eventually support:
- Zentry platform marketing and platform-admin flows
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
- Zentry platform admin
- tenant mini-admin
- tenant staff
- tenant customers

---

## Backend Impact

### Auth and session rules

Authentication must become tenant-aware.

Requirements:
- tenant users can authenticate only inside their tenant portal
- platform admins authenticate into the Zentry platform
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

Initial white-label launch should keep all providers `platform-managed`.
Later, only `VTU` and `NIN` should allow `tenant-managed` provider configs.

### Support and dispute workflows

Support, disputes, and reports must become tenant-aware.

Principles:
- tenant teams manage first-line customer operations
- Zentry platform admin manages escalation, oversight, billing disputes, and
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
- Zentry platform fee layer
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

Do not begin white-label implementation until:
- current Zentry core flows are stable
- Phase 1 acceptance is materially complete
- wallet/order/provider foundations are ready enough to support tenant scoping
- PWA and security constraints are explicitly carried into the expansion design

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

Do not build custom domains or tenant-owned providers yet.

### Stage 2 — Tenant admin and branded subdomain launch

Build:
- tenant onboarding
- tenant mini-admin
- subdomain-based storefronts
- first-party tenant storefront on the same tenant model
- branding controls
- isolated tenant users/staff dashboards
- tenant service visibility and tenant pricing controls

All providers remain Zentry-managed in this stage.

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

### Stage 6 — Expand only if justified

Possible later work:
- more tenant-managed provider categories
- deeper tenant theming controls
- tenant-level automations and webhooks
- partner analytics and settlement exports

---

## What Must Stay Out of Current Phase 1

Do not introduce these changes into current Phase 1 stabilization work:
- tenant-aware auth rewrites
- global `tenantId` schema migration
- custom-domain routing
- tenant mini-admin implementation
- tenant-scoped wallets/orders/disputes
- tenant-owned provider credentials

Do not preserve a permanent direct-business shortcut outside the tenant model.

Those belong to a dedicated future expansion track after the core platform is
stable enough to carry multi-tenancy safely.

---

## Open Implementation Questions

These are not blockers for the roadmap, but they must be answered before coding:
- exact tenant billing plans and feature gates
- commission formulas for partnership tenants
- how tenant support escalates to Zentry ops
- whether a tenant can operate multiple storefront brands under one account
- whether direct Zentry consumer accounts and tenant customer accounts can ever
  be merged in the future
- compliance and data-retention requirements for tenant-owned customer data

---

## Recommended Next Step

Use this document as the future-state reference only.

Do not start white-label implementation yet.

The next product work should continue stabilizing the current core Zentry
platform. When the core is ready, convert this roadmap into:
- concrete Prisma migrations
- tenant-aware auth changes
- tenant admin UX
- domain provisioning flows
- staged provider-resolution changes
