# CLAUDE.md — Zentry Project AI Context

> **IMPORTANT FOR ALL AI ASSISTANTS:**
> Read this file AND every file listed under "Required Reading" before writing
> a single line of code. No exceptions. These documents define the law of this
> codebase. Deviation = wrong answer.
>
> At the end of every session, update `docs/ai-context/SESSION_LOG.md` and
> update phase status in `docs/ai-context/PHASES.md` if applicable.

---

## What Is Zentry?

Zentry is a **multi-role, wallet-based government services escrow marketplace**
built as a Progressive Web Application (PWA). It operates in Nigeria and
connects students/cyber cafes (service requesters) with licensed CBT centers
(service fulfillers) for government document services (JAMB, NIMC, NECO) and
automated VTU services (Airtime, Data, Cable TV, Electricity).

**The core mechanic:** Funds are escrowed on order creation. CBT centers pick
jobs from a pool, fulfill them, and are paid after a 2-hour dispute window.
The platform takes a commission on every transaction. Pricing is fixed by
admin only.

---

## Required Reading (in order)

| File | What It Governs |
|---|---|
| `docs/ai-context/ARCHITECTURE.md` | System design, tech stack, folder structure, monorepo layout |
| `docs/ai-context/DATABASE.md` | Prisma schema rules, money handling, naming conventions |
| `docs/ai-context/SECURITY.md` | Non-negotiable security rules — enforced in every file |
| `docs/ai-context/CONVENTIONS.md` | TypeScript style, naming, component patterns, API shape |
| `docs/ai-context/PROVIDERS.md` | Provider Abstraction Layer (PAL) — how all external APIs work |
| `docs/ai-context/PHASES.md` | Current phase, what is built, what is NOT built yet |
| `docs/ai-context/DECISIONS.md` | Architecture Decision Records — why we chose X over Y |
| `docs/ai-context/SESSION_LOG.md` | What was done in previous sessions |

---

## User Roles (never add or change without explicit instruction)

| Role | Constant | Description |
|---|---|---|
| Student | `STUDENT` | Individual requesting government services |
| Cyber Cafe | `CYBER_CAFE` | Business submitting jobs on behalf of students |
| CBT Center | `CBT_CENTER` | Licensed fulfiller — picks jobs, uploads results |
| Super Admin | `SUPER_ADMIN` | Platform owner — full control |

---

## Repo Structure (top level)

```
zentry/
├── apps/
│   ├── web/          # Next.js 15 PWA — mobile-first, installable
│   └── api/          # NestJS — REST + WebSocket
├── packages/
│   ├── types/        # Shared enums & TypeScript interfaces
│   ├── utils/        # Shared pure utility functions
│   └── validators/   # Shared Zod schemas (used by both apps)
├── docs/
│   └── ai-context/   # THIS FOLDER — read before every session
├── CLAUDE.md         # This file — AI entry point
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Absolute Rules (memorise these)

1. **Money is always in KOBO** (integer). Never floats. Never "Naira".
2. **All IDs are UUID v4.** Never auto-increment integers.
3. **TypeScript strict mode.** No `any`. Ever.
4. **All external providers sit behind interfaces.** Never call a payment or
   VTU API directly from business logic.
5. **Every API route is protected by default.** Explicitly mark public routes.
6. **Access tokens live in memory only.** Never localStorage. Never cookies.
   Refresh tokens in httpOnly cookies only.
7. **Escrow release is triggered by Bull queue timer only.** Never by client request.
8. **Only admin can set prices and commission rates.** No CBT pricing.
9. **CBT centers require admin approval** before accepting any jobs.
10. **Audit log every financial and auth event.** No exceptions.

---

## Tech Stack (locked — do not change without updating DECISIONS.md)

| Layer | Choice |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion |
| State | Zustand (global) + TanStack Query (server state) |
| Backend | NestJS, TypeScript, Prisma |
| Database | PostgreSQL (all money in KOBO as BigInt) |
| Queue | Bull + Redis |
| Real-time | Socket.io |
| Auth | JWT (15min) + Refresh Token rotation (7d, httpOnly cookie) |
| Payments | FintavaPay (primary), Paystack, Flutterwave (backups) |
| VTU | Pluggable via IVtuProvider interface |
| SMS | Termii |
| Email | Resend |
| Storage | Cloudinary (signed URLs, time-limited) |
| PWA | next-pwa + Workbox |
| Monorepo | pnpm workspaces + Turborepo |

---

## Brand

| Token | Value |
|---|---|
| Name | Zentry |
| Tagline | Fast. Trusted. Government Services, Simplified. |
| Primary | `#0D1B3E` (Deep Navy) |
| Accent | `#F5A623` (Golden Amber) |
| Teal | `#0891B2` |
| Font | Plus Jakarta Sans |

---

## Session Update Instructions

At the end of every coding session, the AI assistant MUST:

1. Append a new entry to `docs/ai-context/SESSION_LOG.md` with:
   - Date
   - What was built/changed
   - Files created or modified
   - Any decisions made (add to DECISIONS.md if architectural)
   - Current phase status

2. Update `docs/ai-context/PHASES.md`:
   - Mark completed checklist items with `[x]`
   - Note blockers if any

3. If a new architectural decision was made, add an ADR entry to
   `docs/ai-context/DECISIONS.md`.
