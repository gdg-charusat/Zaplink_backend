-- CreateEnum
CREATE TYPE "ZapType" AS ENUM ('PDF', 'IMAGE', 'VIDEO', 'AUDIO', 'ZIP', 'URL', 'TEXT', 'WORD', 'PPT', 'UNIVERSAL');

-- CreateTable
CREATE TABLE "Zap" (
    "id" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "qrId" TEXT NOT NULL,
    "qrType" "ZapType" NOT NULL,
    "name" TEXT,
    "cloudUrl" TEXT,
    "originalUrl" TEXT,
    "passwordHash" TEXT,
    "maxViews" INTEGER,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "quizQuestion" TEXT,
    "quizAnswerHash" TEXT,
    "unlockAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Zap_shortId_key" ON "Zap"("shortId");

-- CreateIndex
CREATE UNIQUE INDEX "Zap_qrId_key" ON "Zap"("qrId");
