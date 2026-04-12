-- CreateEnum
CREATE TYPE "ProviderConfigScope" AS ENUM ('PLATFORM', 'TENANT');

-- AlterTable
ALTER TABLE "platform_provider_configs"
ADD COLUMN "scopeKey" TEXT NOT NULL DEFAULT 'platform',
ADD COLUMN "scopeType" "ProviderConfigScope" NOT NULL DEFAULT 'PLATFORM';

-- DropIndex
DROP INDEX "platform_provider_configs_providerType_providerKey_key";

-- CreateTable
CREATE TABLE "provider_validation_events" (
  "id" TEXT NOT NULL,
  "providerConfigId" TEXT,
  "providerType" TEXT NOT NULL,
  "providerKey" TEXT NOT NULL,
  "scopeType" "ProviderConfigScope" NOT NULL DEFAULT 'PLATFORM',
  "scopeKey" TEXT NOT NULL DEFAULT 'platform',
  "rolloutMode" "ProviderRolloutMode" NOT NULL,
  "effectiveMode" TEXT NOT NULL,
  "probeStatus" TEXT NOT NULL,
  "probeMessage" TEXT NOT NULL,
  "missingConfig" JSONB,
  "endpointBaseUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "provider_validation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ppc_type_key_scope_unique"
ON "platform_provider_configs"("providerType", "providerKey", "scopeType", "scopeKey");

-- CreateIndex
CREATE INDEX "ppc_type_key_scope_idx"
ON "platform_provider_configs"("providerType", "providerKey", "scopeType", "scopeKey");

-- CreateIndex
CREATE INDEX "pve_lookup_created_idx"
ON "provider_validation_events"("providerType", "providerKey", "scopeType", "scopeKey", "createdAt");

-- AddForeignKey
ALTER TABLE "provider_validation_events"
ADD CONSTRAINT "provider_validation_events_providerConfigId_fkey"
FOREIGN KEY ("providerConfigId") REFERENCES "platform_provider_configs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
