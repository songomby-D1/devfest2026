-- NFT-04: mint requests of published items, with their transaction state.

-- CreateEnum
CREATE TYPE "MintStatus" AS ENUM ('pending', 'confirmed', 'failed');

-- CreateTable
CREATE TABLE "mint_requests" (
    "id" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "MintStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "chainId" INTEGER NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "tokenUri" TEXT,
    "metadataCid" TEXT,
    "masterHash" TEXT,
    "txHash" TEXT,
    "tokenId" TEXT,
    "failureCode" TEXT,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "submittedAt" TIMESTAMPTZ(3),
    "confirmedAt" TIMESTAMPTZ(3),
    "failedAt" TIMESTAMPTZ(3),

    CONSTRAINT "mint_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mint_requests_requesterId_idempotencyKey_key" ON "mint_requests"("requesterId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "mint_requests_contentId_createdAt_idx" ON "mint_requests"("contentId", "createdAt");

-- CreateIndex
CREATE INDEX "mint_requests_status_createdAt_idx" ON "mint_requests"("status", "createdAt");

-- One live mint per item: a failed request may be retried with a new key,
-- but never while another one is pending or once one is confirmed.
-- Partial index, not expressible in schema.prisma.
CREATE UNIQUE INDEX "mint_requests_contentId_live_key" ON "mint_requests"("contentId") WHERE "status" IN ('pending', 'confirmed');

-- A confirmed request always has its token; a failed one its code.
ALTER TABLE "mint_requests" ADD CONSTRAINT "mint_requests_confirmed_token_check" CHECK ("status" <> 'confirmed' OR "tokenId" IS NOT NULL);
ALTER TABLE "mint_requests" ADD CONSTRAINT "mint_requests_failed_code_check" CHECK ("status" <> 'failed' OR "failureCode" IS NOT NULL);
