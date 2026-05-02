-- AlterTable: add platformFeePercent, make platformFee and totalPrice default to 0
ALTER TABLE "Service" ADD COLUMN "platformFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Service" ALTER COLUMN "platformFee" SET DEFAULT 0;
ALTER TABLE "Service" ALTER COLUMN "totalPrice" SET DEFAULT 0;
