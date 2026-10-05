/*
  Warnings:

  - A unique constraint covering the columns `[companyId,branchId,holidayDate,holidayName]` on the table `holidays` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "holidays_companyId_branchId_holidayDate_holidayName_key" ON "holidays"("companyId", "branchId", "holidayDate", "holidayName");
