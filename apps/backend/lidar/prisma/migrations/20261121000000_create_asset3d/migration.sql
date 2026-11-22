-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('pending', 'ready');

-- CreateTable
CREATE TABLE "Asset3d" (
    "id" UUID NOT NULL,
    "contentId" TEXT NOT NULL,
    "objectKey1k" TEXT NOT NULL,
    "objectKey2k" TEXT NOT NULL,
    "posterKey" TEXT NOT NULL,
    "usdzKey" TEXT,
    "size1kBytes" INTEGER NOT NULL,
    "size2kBytes" INTEGER NOT NULL,
    "posterBytes" INTEGER NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset3d_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset3d_contentId_key" ON "Asset3d"("contentId");
