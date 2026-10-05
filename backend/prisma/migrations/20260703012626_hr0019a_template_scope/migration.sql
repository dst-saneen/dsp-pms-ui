-- CreateTable
CREATE TABLE "OnboardingTemplateScope" (
    "id" TEXT NOT NULL,
    "onboardingTemplateVersionId" TEXT NOT NULL,
    "companyId" TEXT,
    "branchId" TEXT,
    "departmentId" TEXT,
    "designationId" TEXT,
    "employeeType" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingTemplateScope_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnboardingTemplateScope_companyId_idx" ON "OnboardingTemplateScope"("companyId");

-- CreateIndex
CREATE INDEX "OnboardingTemplateScope_branchId_idx" ON "OnboardingTemplateScope"("branchId");

-- CreateIndex
CREATE INDEX "OnboardingTemplateScope_departmentId_idx" ON "OnboardingTemplateScope"("departmentId");

-- CreateIndex
CREATE INDEX "OnboardingTemplateScope_designationId_idx" ON "OnboardingTemplateScope"("designationId");

-- CreateIndex
CREATE INDEX "OnboardingTemplateScope_employeeType_idx" ON "OnboardingTemplateScope"("employeeType");

-- CreateIndex
CREATE INDEX "OnboardingTemplateScope_priority_idx" ON "OnboardingTemplateScope"("priority");

-- CreateIndex
CREATE INDEX "OnboardingTemplateScope_isActive_idx" ON "OnboardingTemplateScope"("isActive");

-- AddForeignKey
ALTER TABLE "OnboardingTemplateScope" ADD CONSTRAINT "OnboardingTemplateScope_onboardingTemplateVersionId_fkey" FOREIGN KEY ("onboardingTemplateVersionId") REFERENCES "OnboardingTemplateVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTemplateScope" ADD CONSTRAINT "OnboardingTemplateScope_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTemplateScope" ADD CONSTRAINT "OnboardingTemplateScope_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTemplateScope" ADD CONSTRAINT "OnboardingTemplateScope_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTemplateScope" ADD CONSTRAINT "OnboardingTemplateScope_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "designations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
