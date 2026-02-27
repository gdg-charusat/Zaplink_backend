-- AlterTable
ALTER TABLE "Zap" ALTER COLUMN "deletionToken" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ZapAnalytics" (
    "id" TEXT NOT NULL,
    "zapId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "deviceType" TEXT,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZapAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ZapAnalytics_zapId_idx" ON "ZapAnalytics"("zapId");

-- AddForeignKey
ALTER TABLE "ZapAnalytics" ADD CONSTRAINT "ZapAnalytics_zapId_fkey" FOREIGN KEY ("zapId") REFERENCES "Zap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
