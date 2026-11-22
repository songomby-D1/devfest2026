-- CONTENT-04: claim review history and the `return` and `reject` decisions
-- in the publication history.

-- AlterEnum
ALTER TYPE "PublicationAction" ADD VALUE 'return';
ALTER TYPE "PublicationAction" ADD VALUE 'reject';

-- CreateEnum
CREATE TYPE "ClaimTarget" AS ENUM ('item', 'description');

-- CreateTable
CREATE TABLE "claim_reviews" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "target" "ClaimTarget" NOT NULL,
    "fromStatus" "ClaimStatus" NOT NULL,
    "outcome" "ClaimStatus" NOT NULL,
    "rationale" TEXT NOT NULL,
    "evidence" TEXT[],
    "reviewerId" UUID NOT NULL,
    "reviewedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "claim_reviews_pkey" PRIMARY KEY ("id"),
    -- A review records an outcome; only an edit resets a claim (D18).
    CONSTRAINT "claim_reviews_outcome_reviewed" CHECK ("outcome" <> 'unreviewed')
);

-- CreateIndex
CREATE INDEX "claim_reviews_itemId_target_reviewedAt_idx" ON "claim_reviews"("itemId", "target", "reviewedAt");

-- AddForeignKey
ALTER TABLE "claim_reviews" ADD CONSTRAINT "claim_reviews_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
