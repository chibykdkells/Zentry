-- Add iconUrl field to Tenant for per-tenant PWA/favicon icon
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "iconUrl" TEXT;
