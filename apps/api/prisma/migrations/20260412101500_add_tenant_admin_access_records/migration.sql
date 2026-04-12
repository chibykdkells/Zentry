CREATE TABLE "TenantAdminAccess" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdById" TEXT,
  "email" TEXT NOT NULL,
  "encryptedTempPassword" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastResetAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantAdminAccess_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TenantAdminAccess_tenantId_isActive_idx"
ON "TenantAdminAccess"("tenantId", "isActive");

CREATE INDEX "TenantAdminAccess_userId_isActive_idx"
ON "TenantAdminAccess"("userId", "isActive");

CREATE INDEX "TenantAdminAccess_createdAt_idx"
ON "TenantAdminAccess"("createdAt");

ALTER TABLE "TenantAdminAccess"
ADD CONSTRAINT "TenantAdminAccess_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantAdminAccess"
ADD CONSTRAINT "TenantAdminAccess_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
