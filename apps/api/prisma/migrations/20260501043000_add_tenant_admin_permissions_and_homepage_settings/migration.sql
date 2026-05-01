ALTER TABLE "users"
ADD COLUMN "adminPermissions" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "tenants"
ADD COLUMN "homepageTemplate" TEXT NOT NULL DEFAULT 'spotlight',
ADD COLUMN "homepageHeading" TEXT,
ADD COLUMN "homepageSubheading" TEXT,
ADD COLUMN "homepageAbout" TEXT,
ADD COLUMN "homepageManualSteps" JSONB NOT NULL DEFAULT '[]';
