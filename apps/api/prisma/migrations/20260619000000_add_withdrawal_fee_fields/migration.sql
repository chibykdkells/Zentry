-- Add fee and payout fields to WithdrawalRequest
ALTER TABLE "WithdrawalRequest" ADD COLUMN IF NOT EXISTS "feeKobo" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "WithdrawalRequest" ADD COLUMN IF NOT EXISTS "payoutKobo" BIGINT NOT NULL DEFAULT 0;
