-- CONTENT-02: publication history and listing indexes for keyset pagination
-- on (createdAt, id) in each listing scope.

-- CreateEnum
CREATE TYPE "PublicationAction" AS ENUM ('publish', 'unpublish');

-- CreateTable
CREATE TABLE "publication_events" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "action" "PublicationAction" NOT NULL,
    "actorId" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publication_events_pkey" PRIMARY KEY ("id")
);

-- DropIndex
DROP INDEX "items_ownerId_idx";

-- DropIndex
DROP INDEX "items_publicationStatus_idx";

-- CreateIndex
CREATE INDEX "items_publicationStatus_createdAt_id_idx" ON "items"("publicationStatus", "createdAt", "id");

-- CreateIndex
CREATE INDEX "items_ownerId_createdAt_id_idx" ON "items"("ownerId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "items_submissionStatus_createdAt_id_idx" ON "items"("submissionStatus", "createdAt", "id");

-- CreateIndex
CREATE INDEX "publication_events_itemId_createdAt_idx" ON "publication_events"("itemId", "createdAt");

-- AddForeignKey
ALTER TABLE "publication_events" ADD CONSTRAINT "publication_events_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
