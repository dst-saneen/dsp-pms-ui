-- DropIndex
DROP INDEX "EmployeeTaxProfile_employeeId_key";

-- CreateIndex
CREATE INDEX "EmployeeTaxProfile_employeeId_idx" ON "EmployeeTaxProfile"("employeeId");
