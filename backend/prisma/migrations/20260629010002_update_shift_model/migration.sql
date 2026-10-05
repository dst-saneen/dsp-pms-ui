/*
  Warnings:

  - You are about to drop the column `graceMinutes` on the `shifts` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[companyId,shiftCode]` on the table `shifts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,shiftName]` on the table `shifts` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `companyId` to the `shifts` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "shifts_shiftCode_key";

-- AlterTable
ALTER TABLE "shifts" DROP COLUMN "graceMinutes",
ADD COLUMN     "companyId" TEXT NOT NULL,
ADD COLUMN     "graceInMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "graceOutMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "remarks" TEXT;

-- CreateIndex
CREATE INDEX "shifts_companyId_idx" ON "shifts"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_companyId_shiftCode_key" ON "shifts"("companyId", "shiftCode");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_companyId_shiftName_key" ON "shifts"("companyId", "shiftName");

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
