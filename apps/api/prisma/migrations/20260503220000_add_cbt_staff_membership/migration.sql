-- Add CBT_STAFF value to UserRole enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CBT_STAFF';

-- CreateTable cbt_staff_memberships
CREATE TABLE "cbt_staff_memberships" (
    "id"        TEXT NOT NULL,
    "cbtId"     TEXT NOT NULL,
    "staffId"   TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cbt_staff_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex unique on staffId (one user can only be staff of one center)
CREATE UNIQUE INDEX "cbt_staff_memberships_staffId_key" ON "cbt_staff_memberships"("staffId");

-- CreateIndex on cbtId for fast lookup of a center's staff
CREATE INDEX "cbt_staff_memberships_cbtId_idx" ON "cbt_staff_memberships"("cbtId");

-- AddForeignKey cbt -> User (the CBT center owner)
ALTER TABLE "cbt_staff_memberships" ADD CONSTRAINT "cbt_staff_memberships_cbtId_fkey"
    FOREIGN KEY ("cbtId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey staff -> User (the staff member)
ALTER TABLE "cbt_staff_memberships" ADD CONSTRAINT "cbt_staff_memberships_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
