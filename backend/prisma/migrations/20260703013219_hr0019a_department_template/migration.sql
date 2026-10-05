-- CreateTable
CREATE TABLE "OnboardingDepartmentTemplate" (
    "id" TEXT NOT NULL,
    "onboardingTemplateVersionId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "approvalWorkflowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingDepartmentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnboardingDepartmentTemplate_departmentId_idx" ON "OnboardingDepartmentTemplate"("departmentId");

-- CreateIndex
CREATE INDEX "OnboardingDepartmentTemplate_approvalWorkflowId_idx" ON "OnboardingDepartmentTemplate"("approvalWorkflowId");

-- CreateIndex
CREATE INDEX "OnboardingDepartmentTemplate_isActive_idx" ON "OnboardingDepartmentTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingDepartmentTemplate_onboardingTemplateVersionId_de_key" ON "OnboardingDepartmentTemplate"("onboardingTemplateVersionId", "departmentId");

-- AddForeignKey
ALTER TABLE "OnboardingDepartmentTemplate" ADD CONSTRAINT "OnboardingDepartmentTemplate_onboardingTemplateVersionId_fkey" FOREIGN KEY ("onboardingTemplateVersionId") REFERENCES "OnboardingTemplateVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingDepartmentTemplate" ADD CONSTRAINT "OnboardingDepartmentTemplate_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingDepartmentTemplate" ADD CONSTRAINT "OnboardingDepartmentTemplate_approvalWorkflowId_fkey" FOREIGN KEY ("approvalWorkflowId") REFERENCES "approval_workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
