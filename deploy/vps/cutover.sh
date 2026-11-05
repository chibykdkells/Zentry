#!/bin/bash
# Move Zendocx's (Zentry's) data from Neon to this server.
#
#   cutover.sh --rehearsal   copy + verify, keep the API in rehearsal mode
#   cutover.sh --for-real    copy + verify, then switch the API to production
#
# Run on the server as root. Before --for-real, the Fly machine must already be
# CORDONED and STOPPED so nothing writes to Neon after the copy (see
# docs/vps-cutover-runbook.md). Stops with a non-zero exit, before switching
# anything on, if any money total, any table's row count (kv_store cache rows
# excepted) or the migration ledger differs between Neon and the copy.
set -euo pipefail
MODE="${1:-}"; [ "$MODE" = --rehearsal ] || [ "$MODE" = --for-real ] || { echo "usage: $0 --rehearsal|--for-real"; exit 2; }
S=/opt/zendocx/secrets; B=/opt/zendocx/backups; Q=/opt/zendocx/repo/deploy/vps/verify.sql
TS=$(date -u +%Y%m%dT%H%M%SZ); PG=zendocx-postgres-1; HEALTH=https://api.ecafe.app/health
log() { echo "[$(date -u +%T)] $*"; }
t0=$(date +%s); mkdir -p $B; chmod 700 $B
[ "$MODE" = --for-real ] && [ ! -s $S/api.env.prod ] && { log "missing $S/api.env.prod — stopping"; exit 1; }

log "1/8 final copy from Neon"
docker run --rm --env-file $S/neon.env -v $B:/out postgres:17 \
  sh -c 'pg_dump "$NEON_DIRECT_URL" -Fc --no-owner --no-privileges -f /out/cutover-'"$TS"'.dump' 2>&1 | mask-db-urls
chmod 600 $B/cutover-$TS.dump; log "    $(du -h $B/cutover-$TS.dump | cut -f1)"

log "2/8 stop the API (no writes during the swap)"
docker stop zendocx-api-1 >/dev/null 2>&1 || true
# If anything below fails before the switch, bring the API back as it was.
restore_api() { log "    stopped before switching anything on; restarting the API with its current settings"; zendocx up -d api >/dev/null 2>&1 || true; }
trap restore_api ERR

log "3/8 fresh database, empty queues"
docker exec -i $PG psql -U zendocx -d postgres -v ON_ERROR_STOP=1 -q <<'SQL'
DROP DATABASE IF EXISTS zendocx WITH (FORCE);
CREATE DATABASE zendocx OWNER zendocx;
SQL
# Redis holds only Bull jobs for Zendocx. The API rebuilds escrow-release and
# delivery-deadline timers from the database on start, so start from empty.
docker exec zendocx-redis-1 redis-cli FLUSHALL >/dev/null

log "4/8 restore"
docker run --rm --network zendocx_internal --env-file $S/compose.env -v $B:/in:ro postgres:17 \
  sh -c 'pg_restore --no-owner --no-privileges --exit-on-error -d "postgresql://zendocx:$POSTGRES_PASSWORD@postgres:5432/zendocx" /in/cutover-'"$TS"'.dump' 2>&1 | mask-db-urls

log "5/8 verify: money totals, row counts, migration ledger"
docker run --rm --env-file $S/neon.env -v $Q:/q.sql:ro postgres:17 \
  sh -c 'psql "$NEON_DIRECT_URL" -X -q -v ON_ERROR_STOP=1 -f /q.sql' 2>&1 | mask-db-urls | grep -v '^$' | sort > $B/cutover-$TS-neon.txt
docker exec -i $PG psql -U zendocx -d zendocx -X -q -v ON_ERROR_STOP=1 -f - < $Q | grep -v '^$' | sort > $B/cutover-$TS-vps.txt
chmod 600 $B/cutover-$TS-*.txt
n_money=$(grep -c '^money|' $B/cutover-$TS-vps.txt || true); n_rows=$(grep -c '^rows|' $B/cutover-$TS-vps.txt || true); n_mig=$(grep -c '^migration|' $B/cutover-$TS-vps.txt || true)
[ "$n_money" -gt 0 ] && [ "$n_rows" -gt 0 ] && [ "$n_mig" -gt 0 ] || { log "    verification produced no figures — stopping"; false; }
diff $B/cutover-$TS-neon.txt $B/cutover-$TS-vps.txt > $B/cutover-$TS-diff.txt || true
blocking=$(grep -E '^[<>] ' $B/cutover-$TS-diff.txt | grep -vE '^[<>] rows\|kv_store\|' || true)
if [ -n "$blocking" ]; then
  log "    MISMATCH — stopping. Production settings NOT switched on."
  echo "$blocking" | sed 's/^/      /'
  [ "$MODE" = --for-real ] && log "    Roll back: uncordon and start the Fly machine again (runbook, Rollback)."
  false
fi
cache=$(grep -cE '^[<>] rows\|kv_store\|' $B/cutover-$TS-diff.txt || true)
if [ "$cache" = 0 ]; then d="none"; else d="kv_store cache row count only"; fi
log "    $n_money money totals identical, $n_rows tables, $n_mig ledger rows; differences: $d"
trap - ERR

if [ "$MODE" = --for-real ]; then
  log "6/8 switch the API to PRODUCTION settings"
  cp -p $S/api.env $S/api.env.rehearsal; cp -p $S/api.env.prod $S/api.env
else
  log "6/8 (rehearsal) API stays in rehearsal mode"
fi

log "7/8 migrations, then start the API"
# A failed migration stops here (pipefail); the display filter below cannot.
out=$(zendocx run --rm --no-deps api node_modules/.bin/prisma migrate deploy --schema=apps/api/prisma/schema.prisma 2>&1 | mask-db-urls) \
  || { echo "$out" | tail -20; log "    MIGRATION FAILED — API is stopped. Runbook: Rollback."; exit 1; }
echo "$out" | grep -E "migrations found|No pending|applied" | sed 's/^/    /' || true
zendocx up -d --force-recreate api >/dev/null 2>&1
h=""; for i in $(seq 1 40); do h=$(curl -fsS --max-time 5 $HEALTH 2>/dev/null || true); case "$h" in *'"db":"ok"'*) break;; esac; sleep 3; done
log "    health: ${h:-NO RESPONSE}"
mode=$(docker exec zendocx-api-1 printenv ZENDOCX_MODE 2>/dev/null || true)
log "    API settings: ${mode:-production}"
[ "$MODE" = --for-real ] && [ -n "$mode" ] && { log "    expected PRODUCTION settings but the API reports '$mode'"; exit 1; }

log "8/8 fresh full backup (in background)"
systemd-run --unit=zendocx-backup-cutover-$TS --collect /usr/local/bin/zendocx-backup full >/dev/null
log "done in $(( $(date +%s) - t0 ))s"
