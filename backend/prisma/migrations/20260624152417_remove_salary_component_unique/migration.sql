-- DropIndex
DROP INDEX "SalaryComponent_companyId_componentCode_key";

-- CreateIndex
CREATE INDEX "SalaryComponent_companyId_componentCode_idx" ON "SalaryComponent"("companyId", "componentCode");
