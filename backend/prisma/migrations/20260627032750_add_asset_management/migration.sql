/*
  Warnings:

  - A unique constraint covering the columns `[companyId,assetTypeCode]` on the table `asset_types` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,assetTypeName]` on the table `asset_types` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,assetCode]` on the table `assets` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `assetCategoryId` to the `asset_types` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "assets_assetCode_key";

-- AlterTable
ALTER TABLE "asset_types" ADD COLUMN     "assetCategoryId" TEXT NOT NULL,
ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "purchaseCost" DECIMAL(65,30),
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "warrantyExpiry" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "asset_categories" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assetCategoryCode" TEXT NOT NULL,
    "assetCategoryName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_categories_companyId_idx" ON "asset_categories"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_categories_companyId_assetCategoryCode_key" ON "asset_categories"("companyId", "assetCategoryCode");

-- CreateIndex
CREATE UNIQUE INDEX "asset_categories_companyId_assetCategoryName_key" ON "asset_categories"("companyId", "assetCategoryName");

-- CreateIndex
CREATE INDEX "asset_types_assetCategoryId_idx" ON "asset_types"("assetCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_types_companyId_assetTypeCode_key" ON "asset_types"("companyId", "assetTypeCode");

-- CreateIndex
CREATE UNIQUE INDEX "asset_types_companyId_assetTypeName_key" ON "asset_types"("companyId", "assetTypeName");

-- CreateIndex
CREATE INDEX "assets_branchId_idx" ON "assets"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "assets_companyId_assetCode_key" ON "assets"("companyId", "assetCode");

-- AddForeignKey
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_types" ADD CONSTRAINT "asset_types_assetCategoryId_fkey" FOREIGN KEY ("assetCategoryId") REFERENCES "asset_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
