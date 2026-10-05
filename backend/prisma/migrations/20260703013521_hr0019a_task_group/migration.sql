-- AlterTable
ALTER TABLE "OnboardingTemplateTask" ADD COLUMN     "taskGroupId" TEXT;

-- CreateTable
CREATE TABLE "OnboardingTaskGroup" (
    "id" TEXT NOT NULL,
    "onboardingDepartmentTemplateId" TEXT NOT NULL,
    "groupCode" TEXT,
    "groupName" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingTaskGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnboardingTaskGroup_onboardingDepartmentTemplateId_idx" ON "OnboardingTaskGroup"("onboardingDepartmentTemplateId");

-- CreateIndex
CREATE INDEX "OnboardingTaskGroup_displayOrder_idx" ON "OnboardingTaskGroup"("displayOrder");

-- CreateIndex
CREATE INDEX "OnboardingTaskGroup_isActive_idx" ON "OnboardingTaskGroup"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingTaskGroup_onboardingDepartmentTemplateId_groupNam_key" ON "OnboardingTaskGroup"("onboardingDepartmentTemplateId", "groupName");

-- CreateIndex
CREATE INDEX "OnboardingTemplateTask_taskGroupId_idx" ON "OnboardingTemplateTask"("taskGroupId");

-- AddForeignKey
ALTER TABLE "OnboardingTaskGroup" ADD CONSTRAINT "OnboardingTaskGroup_onboardingDepartmentTemplateId_fkey" FOREIGN KEY ("onboardingDepartmentTemplateId") REFERENCES "OnboardingDepartmentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTemplateTask" ADD CONSTRAINT "OnboardingTemplateTask_taskGroupId_fkey" FOREIGN KEY ("taskGroupId") REFERENCES "OnboardingTaskGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
