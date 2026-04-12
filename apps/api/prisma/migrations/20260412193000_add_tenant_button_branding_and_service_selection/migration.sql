ALTER TABLE "tenants"
ADD COLUMN "buttonColor" TEXT NOT NULL DEFAULT '#0D1B3E',
ADD COLUMN "usesCustomServiceSelection" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "tenant_service_selections" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "serviceSlug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tenant_service_selections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_service_selections_tenantId_serviceSlug_key"
ON "tenant_service_selections"("tenantId", "serviceSlug");

CREATE INDEX "tenant_service_selections_tenantId_idx"
ON "tenant_service_selections"("tenantId");

CREATE INDEX "tenant_service_selections_serviceSlug_idx"
ON "tenant_service_selections"("serviceSlug");

ALTER TABLE "tenant_service_selections"
ADD CONSTRAINT "tenant_service_selections_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
