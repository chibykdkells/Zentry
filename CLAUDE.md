# CLAUDE.md — ZenDocx Project AI Context

> **IMPORTANT FOR ALL AI ASSISTANTS:**
> Read this file AND every file listed under "Required Reading" before writing
> a single line of code. No exceptions. These documents define the law of this
> codebase. Deviation = wrong answer.
>
> At the end of every session, update `docs/ai-context/SESSION_LOG.md` and
> update phase status in `docs/ai-context/PHASES.md` if applicable.

---

---

## Where the API and database live: the Hostinger VPS (since 2026-11-05)

**Zentry runs on a shared Hostinger VPS.** Moved from Fly.io + Neon + Upstash on
**2026-11-05** (cutover ~12:04 UTC, data move 39 s; 14 money totals, 28 tables
and the migration ledger verified identical). The move was forced by cost.
Procedure, rollback and after-care: `docs/vps-cutover-runbook.md`. Server
layout, backups and deploys: `deploy/vps/README.md`.

| | |
|---|---|
| Server | Hostinger KVM 2 (2 vCPU, 8 GB), Ubuntu 26.04, `46.202.195.86`, shared with FEP Assist |
| Server slug | `zendocx` (display name "Zendocx"). Everything Zentry owns on the server is named after it: `/opt/zendocx`, containers `zendocx-*-1`, timers `zendocx-*`, R2 bucket `zendocx-db-backups`, `/opt/edge/sites/zendocx.caddy`. Rules: `/opt/PROJECTS.md`. |
| API | `https://api.ecafe.app` via the shared front door (`edge` Caddy) → `zendocx-api` (`deploy/vps/compose.yml`) |
| Database | PostgreSQL 17 in Docker on the same server, private network only |
| Redis | Container `zendocx-redis-1`, Bull queues only (the KV cache is Postgres `kv_store`). Timers are rebuilt from the database on API start. |
| Access | `ssh fepvps` (root, key only); `zendocx` = docker compose with the server secrets |
| Secrets | `/opt/zendocx/secrets/` on the server, never in the repo |
| Backups | pgBackRest → R2 `zendocx-db-backups`, AES-256, WAL every ≤ 60 s, weekly full + daily diff; restore drill `zendocx-restore-drill` |
| Deploy | push to `main` → CI → `Deploy` workflow (build on server, migrate, swap, verify `gitSha` from `/health`) |
| Frontend | unchanged: Vercel (`www.ecafe.app`), `NEXT_PUBLIC_API_URL=https://api.ecafe.app` |
| Domain | **ecafe.app only.** zendocx.net is retired; `api.zendocx.net` is a temporary bridge for the watch week only. |

Fly (`zentry-api-prod`) is cordoned and stopped; Neon is frozen at the cutover
copy; Upstash (`fly-zentry-redis-prod`) is unused. All three are kept for a
watch week, then deleted. **Do not delete any of them before the row-count
check in the runbook's "After the night" section, and ask the owner first.**

### Rules for the VPS

- **Never touch another project's resources.** FEP Assist (`fepassist`) runs on
  the same server: never stop, restart, rebuild or reconfigure anything labelled
  `vps.project=fepassist` or under `/opt/fepassist`. Never run
  `docker compose down`, `docker system prune` or `docker volume prune`.
- **Only the shared front door publishes ports.** Reload it, never restart it:
  `docker exec edge-caddy-1 caddy reload --config /etc/caddy/Caddyfile`.
- **Never print secrets.** Pipe database output through `mask-db-urls`.
  `docker run --env-file` keeps quotes literally; **docker compose `env_file`
  interpolates `$`** — single-quote any value containing `$` (this cut the
  Fintava key from 65 to 41 characters on cutover day until fixed).
- **`pgbackrest.conf` must be owned 999:999** (the container's postgres user).
- **The Fintava merchant account is shared with FEP Assist.** Its only webhook
  points at FEP Assist. Never change it; Zentry does not use Fintava webhooks.
- **Treat the server as replaceable.** Everything must be rebuildable from the
  repo plus the R2 backups. The backup passphrase is in the owner's password
  manager, not on the server alone.

### History and lessons

- Zentry moved from the Fly MPG cluster `kyzl60x1vgyopj9g` to Neon on
  2026-08-17; that cluster was destroyed on 2026-08-21.
- Migration `20260522120000_enforce_single_job_claim` was applied to production
  in May but never committed; it was recovered from the database into the repo
  on 2026-11-05. Never run migrations against production by hand.
- **Never judge a database empty from `pg_stat_user_tables`.** Use exact
  `COUNT(*)` (see `deploy/vps/verify.sql`).
- **A product having migrated and its old database being disposable are
  separate claims.** Verify the second with row counts on both sides.

---

## What Is ZenDocx?

ZenDocx is a **multi-role, wallet-based government services escrow marketplace**
built as a Progressive Web Application (PWA). It operates in Nigeria and
connects individuals/cyber cafes (service requesters) with licensed CBT centers
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
| Individual | `INDIVIDUAL` | Individual requesting government services |
| CBT Center | `CBT_CENTER` | Licensed fulfiller — picks jobs, uploads results |
| Tenant Admin | `TENANT_ADMIN` | Business licensing the platform — created by SUPER_ADMIN |
| Super Admin | `SUPER_ADMIN` | Platform owner — full control, no tenantId |

---

## Repo Structure (top level)

```
zendocx/
├── apps/
│   ├── web/          # Next.js 16 PWA — mobile-first, installable
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
| Frontend | Next.js 16, TypeScript, Tailwind CSS v4, repo-native components, Framer Motion |
| State | Zustand (global) + TanStack Query (server state) |
| Backend | NestJS, TypeScript, Prisma |
| Database | PostgreSQL (all money in KOBO as BigInt) |
| Queue | Bull + Redis (self-hosted container on the VPS) |
| Real-time | Socket.io |
| Auth | JWT (15min) + Refresh Token rotation (7d, httpOnly cookie) |
| Payments | Paystack (primary), FintavaPay, Flutterwave (backups) |
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
| Name | ZenDocx |
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
