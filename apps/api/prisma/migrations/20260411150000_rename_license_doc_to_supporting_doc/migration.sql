-- Rename licenseDocUrl to supportingDocUrl and make it optional on CbtProfile

ALTER TABLE "CbtProfile" RENAME COLUMN "licenseDocUrl" TO "supportingDocUrl";
ALTER TABLE "CbtProfile" ALTER COLUMN "supportingDocUrl" DROP NOT NULL;
UPDATE "CbtProfile" SET "supportingDocUrl" = NULL WHERE "supportingDocUrl" = '';
