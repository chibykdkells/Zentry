-- CreateEnum
CREATE TYPE "UploadedOrderFileState" AS ENUM ('STAGED', 'ATTACHED', 'DELETED');

-- CreateEnum
CREATE TYPE "UploadedOrderFileContext" AS ENUM ('REQUESTER_DOCUMENT', 'DISPUTE_EVIDENCE');

-- CreateTable
CREATE TABLE "uploaded_order_files" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "publicId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT,
    "state" "UploadedOrderFileState" NOT NULL DEFAULT 'STAGED',
    "context" "UploadedOrderFileContext",
    "attachedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uploaded_order_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uploaded_order_files_publicId_key" ON "uploaded_order_files"("publicId");

-- CreateIndex
CREATE INDEX "uploaded_order_files_userId_state_expiresAt_idx" ON "uploaded_order_files"("userId", "state", "expiresAt");

-- CreateIndex
CREATE INDEX "uploaded_order_files_orderId_idx" ON "uploaded_order_files"("orderId");

-- CreateIndex
CREATE INDEX "uploaded_order_files_state_expiresAt_idx" ON "uploaded_order_files"("state", "expiresAt");

-- AddForeignKey
ALTER TABLE "uploaded_order_files" ADD CONSTRAINT "uploaded_order_files_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_order_files" ADD CONSTRAINT "uploaded_order_files_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
