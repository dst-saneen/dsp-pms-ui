/*
  Warnings:

  - Added the required column `updatedAt` to the `employee_separations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "employee_separations" ADD COLUMN     "approvalTransactionId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "employee_separations_employeeId_idx" ON "employee_separations"("employeeId");

-- CreateIndex
CREATE INDEX "employee_separations_status_idx" ON "employee_separations"("status");
