-- Add NotificationType values
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CBT_EXTENSION_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CBT_EXTENSION_REVIEWED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'JOB_UNASSIGNED';

-- CreateEnum
CREATE TYPE "CbtExtensionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN "deliveryDeadline" TIMESTAMP(3);

-- CreateTable cbt_time_extension_requests
CREATE TABLE "cbt_time_extension_requests" (
    "id"                TEXT NOT NULL,
    "orderId"           TEXT NOT NULL,
    "cbtId"             TEXT NOT NULL,
    "reason"            TEXT NOT NULL,
    "status"            "CbtExtensionStatus" NOT NULL DEFAULT 'PENDING',
    "additionalMinutes" INTEGER,
    "reviewedAt"        TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cbt_time_extension_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cbt_time_extension_requests_orderId_idx" ON "cbt_time_extension_requests"("orderId");
CREATE INDEX "cbt_time_extension_requests_cbtId_idx" ON "cbt_time_extension_requests"("cbtId");
CREATE INDEX "cbt_time_extension_requests_status_idx" ON "cbt_time_extension_requests"("status");
ALTER TABLE "cbt_time_extension_requests" ADD CONSTRAINT "cbt_time_extension_requests_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable cbt_job_blocks
CREATE TABLE "cbt_job_blocks" (
    "id"        TEXT NOT NULL,
    "orderId"   TEXT NOT NULL,
    "cbtId"     TEXT NOT NULL,
    "reason"    TEXT NOT NULL DEFAULT 'deadline_missed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cbt_job_blocks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cbt_job_blocks_orderId_cbtId_key" ON "cbt_job_blocks"("orderId", "cbtId");
CREATE INDEX "cbt_job_blocks_cbtId_idx" ON "cbt_job_blocks"("cbtId");
ALTER TABLE "cbt_job_blocks" ADD CONSTRAINT "cbt_job_blocks_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
