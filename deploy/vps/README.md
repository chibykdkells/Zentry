# Zendocx on the Hostinger VPS

Zentry's API (server slug `zendocx`, display name "Zendocx") runs on the shared
Hostinger VPS `46.202.195.86` at **https://api.ecafe.app**. The frontend stays
on Vercel. Naming rules for every project on the server: `/opt/PROJECTS.md`.

| | |
|---|---|
| Access | `ssh fepvps` (root, key only). `zendocx` = docker compose with the server secrets (`zendocx ps`, `zendocx logs --tail 100 api`). |
| Containers | `zendocx-api-1` (also on network `edge` as `zendocx-api`), `zendocx-postgres-1` (PostgreSQL 17 + pgBackRest), `zendocx-redis-1` (Bull queues). No published ports. |
| Public site | `/opt/edge/sites/zendocx.caddy`; reload with `docker exec edge-caddy-1 caddy reload --config /etc/caddy/Caddyfile` (never restart). |
| Secrets | `/opt/zendocx/secrets/`: `api.env` (live), `api.env.prod`, `compose.env` (POSTGRES_PASSWORD, GIT_SHA), `pgbackrest.conf` (owned 999:999, mode 600). Never in the repo. |
| Backups | pgBackRest → R2 `zendocx-db-backups`, AES-256, WAL every ≤ 60 s. Timers `zendocx-backup-full` (Sun 02:30 UTC), `-diff` (Mon–Sat 02:30), `-check` (07:15), `zendocx-health` (5 min). Passphrase: owner's password manager. |
| Restore drill | `zendocx-restore-drill` (marker → restore from R2 into a scratch container → compare every figure). |
| Server scripts | `server/bin` → `/usr/local/bin`, `server/systemd` → `/etc/systemd/system` (installed by hand, not by CI). |
| Verification | `verify.sql`: money totals, exact row counts, migration ledger. Same file on both sides of a copy. |

## Deploys

Push to `main` → CI (lint, typecheck, build) → **Deploy** workflow
(`.github/workflows/deploy.yml`): rsync to `/opt/zendocx/repo`, build on the
server, `prisma migrate deploy`, swap, then wait until `/health` reports the
pushed commit with `"db":"ok"`. Commits that do not touch the API are skipped.

### One-time: the GitHub deploy key (owner)

Run these on the Mac, in Terminal, one at a time. Nothing needs pasting: each
command reads or writes the files itself.

```sh
# 1. Create a key pair just for Zendocx deploys (no passphrase, so Actions can use it).
ssh-keygen -t ed25519 -N "" -C "zendocx-github-actions-deploy" -f ~/.ssh/zendocx_deploy

# 2. Let that key log in to the server.
ssh fepvps 'cat >> /root/.ssh/authorized_keys' < ~/.ssh/zendocx_deploy.pub

# 3. Give GitHub the private key.
gh secret set VPS_SSH_KEY -R chibykdkells/Zentry < ~/.ssh/zendocx_deploy

# 4. Give GitHub the server's fingerprint, taken from this Mac's trusted copy.
ssh-keygen -F 46.202.195.86 | grep -v '^#' | gh secret set VPS_KNOWN_HOSTS -R chibykdkells/Zentry
```

To revoke: delete the line ending `zendocx-github-actions-deploy` from
`/root/.ssh/authorized_keys` on the server and delete both GitHub secrets.
