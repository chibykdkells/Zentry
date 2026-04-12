-- CreateEnum
CREATE TYPE "ProviderRolloutMode" AS ENUM ('AUTO', 'MOCK', 'LIVE');

-- CreateTable
CREATE TABLE "platform_provider_configs" (
    "id" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "rolloutMode" "ProviderRolloutMode" NOT NULL DEFAULT 'AUTO',
    "baseUrl" TEXT,
    "apiKeyEncrypted" TEXT,
    "apiKeyLast4" TEXT,
    "apiKeyHeader" TEXT,
    "apiKeyPrefix" TEXT,
    "healthPath" TEXT,
    "airtimePath" TEXT,
    "dataPurchasePath" TEXT,
    "dataPlansPath" TEXT,
    "cablePlansPath" TEXT,
    "cableVerifyPath" TEXT,
    "cablePurchasePath" TEXT,
    "electricityVerifyPath" TEXT,
    "electricityPurchasePath" TEXT,
    "notes" TEXT,
    "lastValidatedAt" TIMESTAMP(3),
    "lastValidationStatus" TEXT,
    "lastValidationMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_provider_configs_providerType_providerKey_key" ON "platform_provider_configs"("providerType", "providerKey");

-- CreateIndex
CREATE INDEX "platform_provider_configs_providerType_providerKey_idx" ON "platform_provider_configs"("providerType", "providerKey");
