# Cutover: Fly + Neon → Hostinger VPS

Moves Zentry's API and database from Fly.io (`zentry-api-prod`) + Neon +
Upstash Redis to the shared Hostinger VPS (`46.202.195.86`, server slug
`zendocx`, **https://api.ecafe.app**). The frontend stays on Vercel (ecafe.app);
uploads stay on Cloudinary. The reason is cost.

**Expected downtime: about 15–20 minutes**, most of it the Vercel rebuild. The
data move itself takes about 40 seconds (`cutover.sh --rehearsal` on
2026-11-05: 14 money totals, 28 tables and 25 ledger rows identical; ~21 s with
the API stopped).

Who does what: **[You]** = the platform owner, **[Claude]** = Claude Code from
the Zentry folder on the Mac.

## What does NOT change
- **Fintava**: the merchant account's only webhook is FEP Assist's
  (`https://api.fepassist.com/api/webhooks/fintava`). Zentry has never received
  Fintava webhooks; it asks Fintava's API directly. **Do not touch the Fintava
  webhook setting.** Changing it would break FEP Assist's payment confirmations.
- **Paystack / Flutterwave**: not configured in Zentry. Nothing to move.
- **Data**: users, passwords, PINs, wallets, escrow, transactions, orders, audit
  logs, tenants, prices and provider settings are copied and verified to the kobo.

## What users notice
- The website calls the API at `https://zentry-api-prod.fly.dev` today
  (Vercel `NEXT_PUBLIC_API_URL`, confirmed 2026-11-05 in the live code). After
  cutover it calls `https://api.ecafe.app`.
- Everyone signs in once more (the login cookie belonged to the fly.dev address).
- Tabs left open, and installed apps not yet updated, keep calling fly.dev and
  show errors until they **reload / reopen once** (the service worker uses
  skipWaiting + clientsClaim, so one reload picks up the new code). Fly's
  address cannot be pointed at the VPS, so there is no bridge for it.
- Email comes from `noreply@ecafe.app` instead of `noreply@zendocx.net`.
- The `api.zendocx.net` bridge only keeps older links working (signed file
  links from the last 7 days were built with `API_URL=https://api.zendocx.net`).

## Before the night

| When | Who | Step |
|---|---|---|
| 2 days before | You | Tell users (message below). Ask CBT centers to finish claimed jobs and not to request withdrawals in the window. |
| 2 days before | You | Confirm you can log in to **Vercel, Cloudflare (zendocx.net DNS), Resend (assistnghq) and Fly**. |
| 2 days before | You | Vercel → project serving ecafe.app → Settings → Environment Variables: `NEXT_PUBLIC_API_URL` (Production) is `https://zentry-api-prod.fly.dev` (checked 2026-11-05). It changes to `https://api.ecafe.app` on the night. |
| Day before | You | Cloudflare → zendocx.net → DNS → `api` record: lower its TTL to 1 min (Auto is 5 min). Leave it pointing at Fly. |
| Day before | Claude | `ssh fepvps /opt/zendocx/repo/deploy/vps/cutover.sh --rehearsal` ends with "money totals identical" and "differences: none". |
| Day before | Claude | `zendocx-backup-check` passes; `zendocx-health` is ok; the latest `main` is deployed (Deploy workflow green). |

Message to users:

> Ecafe will be unavailable on **[day] from [time] to [time] (Lagos time)**
> while we move to a new server. Please don't request withdrawals during that
> window. Nothing you have saved will change. Afterwards, close and reopen the
> app (or reload the page) and sign in again. We'll confirm here when it's back.

## On the night

| # | Who | Step | Check |
|---|---|---|---|
| 1 | Claude | Look for anything in flight on Neon: ASSIGNED/IN_PROGRESS orders, COMPLETED orders awaiting escrow release, pending withdrawals, recent pending fundings. | Note them. Timers are rebuilt from the database on the VPS. |
| 2 | Claude | **Cordon, then stop** Fly machine `82edd0f7d3dd68` (Machines API `cordon`, then `stop`). Cordon first: the app auto-starts on requests, so a stop alone would be undone by the next visitor. | `zentry-api-prod.fly.dev/health` stops answering; the machine reports `stopped`. |
| 3 | Claude | `ssh fepvps /opt/zendocx/repo/deploy/vps/cutover.sh --for-real` | Ends with "money totals identical", health `"db":"ok"`, "API settings: production". **If it stops on a mismatch, go to Rollback.** |
| 4 | You | Vercel: set `NEXT_PUBLIC_API_URL` = `https://api.ecafe.app` (Production) and **Redeploy** the latest production deployment. | Build green. |
| 5 | You | **Bridge**: Cloudflare → zendocx.net → DNS → `api`: change the CNAME (Fly) to **A `46.202.195.86`, DNS only (grey cloud)**. | — |
| 6 | Claude | Add `api.zendocx.net` to `/opt/edge/sites/zendocx.caddy` next to `api.ecafe.app`; validate; **reload** edge Caddy. Confirm FEP Assist still answers. | `https://api.zendocx.net/health` and `https://api.ecafe.app/health` give the same `gitSha`. |
| 7 | You | Open `https://ecafe.app` in a private window. Sign in as super admin, then as a CBT center and as an individual. Open Wallet and the job pool. | Pages load; balances match what they were. |
| 8 | Claude | Trigger a password-reset email to an owner address (arrives from `noreply@ecafe.app`). Check `zendocx logs api` for errors. Confirm Fintava calls work (a funding status check). | All work. |
| 9 | You | Tell users it's back. | — |
| 10 | Claude | Update `/opt/PROJECTS.md` (Zendocx row: URL, repo, status) and give you the row for `deploy/edge/PROJECTS.md` in the fep-assist repo. | — |

## Rollback

**Before step 9 (nobody has used the new server yet):** Neon has not changed
since step 2, so going back is safe.
1. Claude: uncordon and start the Fly machine.
2. You: set Vercel's `NEXT_PUBLIC_API_URL` back to `https://zentry-api-prod.fly.dev`; redeploy.
3. You: put the zendocx.net `api` record back to the CNAME `zentry-api-prod.fly.dev`.
4. Claude: switch the VPS back to rehearsal settings:
   `cp -p /opt/zendocx/secrets/api.env.rehearsal /opt/zendocx/secrets/api.env && zendocx up -d --force-recreate api`.

**After step 9:** the VPS holds newer data than Neon. Do not roll back by
switching hosts; fix forward on the VPS. If a rollback is unavoidable, the VPS
database must first be copied back to Neon.

## After the night

| When | Who | Step |
|---|---|---|
| Daily for a week | Claude | `zendocx-backup-check`, health alerts, `zendocx logs api` for errors. |
| After a quiet week | Claude | Compare row counts one last time (Neon is now old; the VPS should have *more*). **Ask before deleting anything.** Then delete the Fly app, the Upstash Redis `fly-zentry-redis-prod`, and the Neon project. |
| Same day | Claude | Remove `api.zendocx.net` from `zendocx.caddy` and reload. Remove `fly.toml` from the repo. |
| Same day | You | Delete the zendocx.net `api` DNS record. Revoke the Fly token `zendocx-migration`. Delete the old zendocx.net-only Resend key. Cancel Fly, Upstash and Neon billing. |
| Same day | Claude | Update CLAUDE.md ("Database") and SESSION_LOG; remove Neon/Fly values from `~/zendocx-prod.env`. |

## Reference
- Server: `ssh fepvps`; `zendocx` = docker compose with the server secrets. Layout, backups, deploys: `deploy/vps/README.md`.
- Secrets: `/opt/zendocx/secrets/` (`api.env` live, `api.env.prod` production, `api.env.rehearsal` after cutover, `compose.env`, `pgbackrest.conf`, `neon.env`).
- Backups: pgBackRest → R2 `zendocx-db-backups`, encrypted. Passphrase: `~/zendocx-backup-passphrase.txt` and the owner's password manager.
- Restore drill: `zendocx-restore-drill`.
