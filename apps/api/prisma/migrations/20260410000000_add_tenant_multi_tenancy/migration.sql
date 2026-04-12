-- Migration: Add multi-tenancy foundation
-- Introduces Tenant model, tenantId on all scoped models,
-- removes CyberCafeProfile, removes CYBER_CAFE role, adds TENANT_ADMIN role,
-- adds tenantFee to Order and Service, and TENANT_COMMISSION to TransactionType.

-- -- Step 1: Create Tenant table -----------------------------------------------

CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "customDomain" TEXT,
    "customDomainVerified" BOOLEAN NOT NULL DEFAULT false,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0D1B3E',
    "accentColor" TEXT NOT NULL DEFAULT '#F5A623',
    "tenantMarginRate" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
CREATE UNIQUE INDEX "tenants_customDomain_key" ON "tenants"("customDomain");

-- -- Step 2: Update UserRole enum (add TENANT_ADMIN, remove CYBER_CAFE) --------

-- First rename the existing enum
ALTER TYPE "UserRole" RENAME TO "UserRole_old";

-- Create the new enum with correct values
CREATE TYPE "UserRole" AS ENUM ('INDIVIDUAL', 'CBT_CENTER', 'TENANT_ADMIN', 'SUPER_ADMIN');

-- Remove CYBER_CAFE users - delete FK-constrained dependents first
DELETE FROM "Transaction"       WHERE "userId" IN (SELECT id FROM "User" WHERE role::text = 'CYBER_CAFE');
DELETE FROM "WithdrawalRequest" WHERE "userId" IN (SELECT id FROM "User" WHERE role::text = 'CYBER_CAFE');
DELETE FROM "Dispute"           WHERE "orderId" IN (SELECT id FROM "Order" WHERE "requesterId" IN (SELECT id FROM "User" WHERE role::text = 'CYBER_CAFE'));
DELETE FROM "Order"             WHERE "requesterId" IN (SELECT id FROM "User" WHERE role::text = 'CYBER_CAFE');
DELETE FROM "User"              WHERE role::text = 'CYBER_CAFE';

-- Drop CyberCafeProfile table (depends on User FK which we're about to alter)
DROP TABLE IF EXISTS "CyberCafeProfile";

-- Alter the User role column to use new enum
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole" USING "role"::text::"UserRole";

-- Drop old enum
DROP TYPE "UserRole_old";

-- -- Step 3: Update TransactionType enum (add TENANT_COMMISSION) ---------------

ALTER TYPE "TransactionType" ADD VALUE 'TENANT_COMMISSION';

-- -- Step 4: Add tenantId to User ---------------------------------------------

ALTER TABLE "User" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- -- Step 5: Add tenantId + tenantFee to Order ---------------------------------

ALTER TABLE "Order" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Order" ADD COLUMN "tenantFee" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Order_tenantId_idx" ON "Order"("tenantId");

-- -- Step 6: Add tenantId to Transaction ---------------------------------------

ALTER TABLE "Transaction" ADD COLUMN "tenantId" TEXT;
CREATE INDEX "Transaction_tenantId_idx" ON "Transaction"("tenantId");

-- -- Step 7: Add tenantId to Dispute -------------------------------------------

ALTER TABLE "Dispute" ADD COLUMN "tenantId" TEXT;
CREATE INDEX "Dispute_tenantId_idx" ON "Dispute"("tenantId");

-- -- Step 8: Add tenantId to WithdrawalRequest ---------------------------------

ALTER TABLE "WithdrawalRequest" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "WithdrawalRequest_tenantId_idx" ON "WithdrawalRequest"("tenantId");

-- -- Step 9: Add tenantId to Notification --------------------------------------

ALTER TABLE "Notification" ADD COLUMN "tenantId" TEXT;
CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");

-- -- Step 10: Add tenantId to AuditLog -----------------------------------------

ALTER TABLE "AuditLog" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- -- Step 11: Add tenantId to CbtProfile ---------------------------------------

ALTER TABLE "CbtProfile" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "CbtProfile" ADD CONSTRAINT "CbtProfile_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "CbtProfile_tenantId_idx" ON "CbtProfile"("tenantId");

-- -- Step 12: Update ServiceCategoryModel (service_categories) -----------------

ALTER TABLE "service_categories" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop old global unique constraints on name and slug
DROP INDEX IF EXISTS "service_categories_name_key";
DROP INDEX IF EXISTS "service_categories_slug_key";

-- Add per-tenant composite unique constraints
CREATE UNIQUE INDEX "service_categories_slug_tenantId_key" ON "service_categories"("slug", "tenantId");
CREATE UNIQUE INDEX "service_categories_name_tenantId_key" ON "service_categories"("name", "tenantId");
CREATE INDEX "service_categories_tenantId_idx" ON "service_categories"("tenantId");

-- -- Step 13: Update Service ---------------------------------------------------

ALTER TABLE "Service" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Service" ADD COLUMN "tenantFee" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Service" ADD CONSTRAINT "Service_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop old global unique constraint on slug
DROP INDEX IF EXISTS "Service_slug_key";

-- Add per-tenant composite unique constraint
CREATE UNIQUE INDEX "Service_slug_tenantId_key" ON "Service"("slug", "tenantId");
CREATE INDEX "Service_tenantId_idx" ON "Service"("tenantId");
