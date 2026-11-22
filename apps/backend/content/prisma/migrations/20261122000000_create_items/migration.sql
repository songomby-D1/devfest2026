-- CONTENT-01: authors, items (ContentId) and descriptions, with separate
-- claim statuses for the item and its description (D18).

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('draft', 'published', 'unpublished');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('in_review', 'returned', 'rejected', 'accepted');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('unreviewed', 'verified', 'uncertain');

-- CreateEnum
CREATE TYPE "ItemKind" AS ENUM ('painting', 'sculpture', 'photograph', 'textile', 'object', 'other');

-- CreateTable
CREATE TABLE "authors" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "community" TEXT,
    "technique" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "ItemKind" NOT NULL,
    "origin" TEXT,
    "period" TEXT,
    "rightsStatement" TEXT NOT NULL,
    "rightsConfirmed" BOOLEAN NOT NULL,
    "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'draft',
    "submissionStatus" "SubmissionStatus" NOT NULL DEFAULT 'in_review',
    "claimStatus" "ClaimStatus" NOT NULL DEFAULT 'unreviewed',
    "authorId" UUID NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "descriptions" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "claimStatus" "ClaimStatus" NOT NULL DEFAULT 'unreviewed',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "descriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "items_authorId_key" ON "items"("authorId");

-- CreateIndex
CREATE INDEX "items_ownerId_idx" ON "items"("ownerId");

-- CreateIndex
CREATE INDEX "items_publicationStatus_idx" ON "items"("publicationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "descriptions_itemId_key" ON "descriptions"("itemId");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "authors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "descriptions" ADD CONSTRAINT "descriptions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

