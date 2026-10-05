/*
  Warnings:

  - A unique constraint covering the columns `[approvalTransactionId]` on the table `leave_requests` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "leave_policies" ADD COLUMN     "accrualMethod" TEXT NOT NULL DEFAULT 'YEARLY',
ADD COLUMN     "accrualRate" DECIMAL(5,2),
ADD COLUMN     "accrualWorkingDays" INTEGER,
ADD COLUMN     "carryForwardExpiryMonths" INTEGER,
ADD COLUMN     "maximumNegativeBalance" DECIMAL(5,2);

-- CreateIndex
CREATE UNIQUE INDEX "leave_requests_approvalTransactionId_key" ON "leave_requests"("approvalTransactionId");

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approvalTransactionId_fkey" FOREIGN KEY ("approvalTransactionId") REFERENCES "approval_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
