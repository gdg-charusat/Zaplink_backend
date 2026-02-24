-- AlterTable
ALTER TABLE "Zap" ADD COLUMN "deletionToken" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Zap_deletionToken_key" ON "Zap"("deletionToken");
