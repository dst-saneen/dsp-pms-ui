/*
  Warnings:

  - You are about to drop the column `workingHours` on the `attendances` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `employee_shifts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "attendances" DROP COLUMN "workingHours",
ADD COLUMN     "approvalStatus" TEXT DEFAULT 'APPROVED',
ADD COLUMN     "lateMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shiftId" TEXT,
ADD COLUMN     "source" TEXT DEFAULT 'MANUAL',
ADD COLUMN     "workedHours" DECIMAL(5,2) NOT NULL DEFAULT 0,
ALTER COLUMN "status" DROP DEFAULT;

-- AlterTable
ALTER TABLE "employee_shifts" DROP COLUMN "updatedAt",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "attendances_status_idx" ON "attendances"("status");

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
