-- AlterTable
ALTER TABLE "EmployeeOnboarding" ADD COLUMN     "completedTasks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalTasks" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN     "attemptNo" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "lastReminderDate" TIMESTAMP(3),
ADD COLUMN     "nextReminderDate" TIMESTAMP(3),
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OnboardingTemplate" ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OnboardingTemplateTask" ADD COLUMN     "allowResubmit" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowSkip" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "EmployeeOnboarding_companyId_idx" ON "EmployeeOnboarding"("companyId");

-- CreateIndex
CREATE INDEX "EmployeeOnboarding_progress_idx" ON "EmployeeOnboarding"("progress");

-- CreateIndex
CREATE INDEX "EmployeeOnboardingTask_status_idx" ON "EmployeeOnboardingTask"("status");

-- CreateIndex
CREATE INDEX "EmployeeOnboardingTask_ownerType_idx" ON "EmployeeOnboardingTask"("ownerType");

-- CreateIndex
CREATE INDEX "EmployeeOnboardingTask_dueDate_idx" ON "EmployeeOnboardingTask"("dueDate");

-- CreateIndex
CREATE INDEX "EmployeeOnboardingTask_approvalTransactionId_idx" ON "EmployeeOnboardingTask"("approvalTransactionId");

-- CreateIndex
CREATE INDEX "OnboardingTemplate_companyId_idx" ON "OnboardingTemplate"("companyId");

-- CreateIndex
CREATE INDEX "OnboardingTemplate_lifecycle_idx" ON "OnboardingTemplate"("lifecycle");

-- CreateIndex
CREATE INDEX "OnboardingTemplate_isActive_idx" ON "OnboardingTemplate"("isActive");

-- CreateIndex
CREATE INDEX "OnboardingTemplateTask_workType_idx" ON "OnboardingTemplateTask"("workType");

-- CreateIndex
CREATE INDEX "OnboardingTemplateTask_ownerType_idx" ON "OnboardingTemplateTask"("ownerType");

-- CreateIndex
CREATE INDEX "OnboardingTemplateTask_referenceType_idx" ON "OnboardingTemplateTask"("referenceType");
