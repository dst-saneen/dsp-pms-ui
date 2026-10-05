-- AlterTable
ALTER TABLE "hr_request_types" ADD COLUMN     "workflowId" TEXT;

-- AddForeignKey
ALTER TABLE "hr_request_types" ADD CONSTRAINT "hr_request_types_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "approval_workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
