/*
  Warnings:

  - A unique constraint covering the columns `[companyId,designationCode]` on the table `designations` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `companyId` to the `designations` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "designations_designationCode_key";

-- AlterTable
ALTER TABLE "designations" ADD COLUMN     "companyId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "designations_companyId_designationCode_key" ON "designations"("companyId", "designationCode");

-- AddForeignKey
ALTER TABLE "designations" ADD CONSTRAINT "designations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
