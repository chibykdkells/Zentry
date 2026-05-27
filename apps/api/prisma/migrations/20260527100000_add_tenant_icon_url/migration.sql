-- Add iconUrl field to Tenant for per-tenant PWA/favicon icon
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "iconUrl" TEXT;
