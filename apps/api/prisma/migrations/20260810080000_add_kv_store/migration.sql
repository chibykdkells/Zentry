-- Durable key/value store, replacing Upstash Redis.
--
-- Redis was a shared pay-as-you-go instance costing $10.04/month across this
-- app and FEP Assist. What RedisService actually held here is caches and
-- short-lived auth state under TTLs — all of which Postgres serves, and
-- Postgres is already paid for.
--
-- Reads filter on expires_at rather than relying on a sweeper, so an expired
-- key is never served even if cleanup is late.

CREATE TABLE IF NOT EXISTS "kv_store" (
  "key"        TEXT         PRIMARY KEY,
  "value"      TEXT         NOT NULL,
  "expiresAt"  TIMESTAMPTZ,
  "createdAt"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "kv_store_expiresAt_idx"
  ON "kv_store" ("expiresAt")
  WHERE "expiresAt" IS NOT NULL;
