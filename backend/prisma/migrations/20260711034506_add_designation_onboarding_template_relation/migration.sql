-- AlterTable
ALTER TABLE "designations" ADD COLUMN     "onboardingTemplateId" TEXT;

-- AddForeignKey
ALTER TABLE "designations" ADD CONSTRAINT "designations_onboardingTemplateId_fkey" FOREIGN KEY ("onboardingTemplateId") REFERENCES "OnboardingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
