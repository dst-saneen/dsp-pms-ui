-- AlterTable
ALTER TABLE "approval_transactions" ADD COLUMN     "requestedById" TEXT;

-- AddForeignKey
ALTER TABLE "approval_transactions" ADD CONSTRAINT "approval_transactions_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
