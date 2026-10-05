-- AlterTable
ALTER TABLE "work_log_headers" ADD COLUMN     "approvalTransactionId" TEXT;

-- AddForeignKey
ALTER TABLE "work_log_headers" ADD CONSTRAINT "work_log_headers_approvalTransactionId_fkey" FOREIGN KEY ("approvalTransactionId") REFERENCES "approval_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
