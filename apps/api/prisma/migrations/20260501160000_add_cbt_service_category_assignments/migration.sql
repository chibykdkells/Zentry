CREATE TABLE "cbt_profile_service_categories" (
    "cbtProfileId" TEXT NOT NULL,
    "serviceCategoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cbt_profile_service_categories_pkey" PRIMARY KEY ("cbtProfileId","serviceCategoryId")
);

CREATE INDEX "cbt_profile_service_categories_serviceCategoryId_idx"
ON "cbt_profile_service_categories"("serviceCategoryId");

ALTER TABLE "cbt_profile_service_categories"
ADD CONSTRAINT "cbt_profile_service_categories_cbtProfileId_fkey"
FOREIGN KEY ("cbtProfileId") REFERENCES "CbtProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cbt_profile_service_categories"
ADD CONSTRAINT "cbt_profile_service_categories_serviceCategoryId_fkey"
FOREIGN KEY ("serviceCategoryId") REFERENCES "service_categories"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
