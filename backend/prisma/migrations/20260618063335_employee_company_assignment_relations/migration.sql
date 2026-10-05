/*
  Warnings:

  - Made the column `allocation` on table `employee_company_assignments` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "employee_company_assignments" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "allocation" SET NOT NULL,
ALTER COLUMN "allocation" SET DEFAULT 100;

-- CreateIndex
CREATE INDEX "employee_company_assignments_companyId_idx" ON "employee_company_assignments"("companyId");

-- AddForeignKey
ALTER TABLE "employee_company_assignments" ADD CONSTRAINT "employee_company_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_company_assignments" ADD CONSTRAINT "employee_company_assignments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
