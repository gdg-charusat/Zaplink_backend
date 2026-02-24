-- AlterTable
ALTER TABLE "Zap" ALTER COLUMN "deletionToken" DROP NOT NULL,
ALTER COLUMN "deletionToken" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ZapAnalytics" (
    "id" TEXT NOT NULL,
    "zapId" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "browser" TEXT NOT NULL,
    "os" TEXT NOT NULL,
    "referer" TEXT,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZapAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ZapAnalytics_zapId_accessedAt_idx" ON "ZapAnalytics"("zapId", "accessedAt");

-- AddForeignKey
ALTER TABLE "ZapAnalytics" ADD CONSTRAINT "ZapAnalytics_zapId_fkey" FOREIGN KEY ("zapId") REFERENCES "Zap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
