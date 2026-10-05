/*
  Warnings:

  - You are about to drop the `hr_requests` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[companyId,requestCode]` on the table `hr_request_types` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `companyId` to the `hr_request_types` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "hr_requests" DROP CONSTRAINT "hr_requests_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "hr_requests" DROP CONSTRAINT "hr_requests_requestTypeId_fkey";

-- DropIndex
DROP INDEX "hr_request_types_requestCode_key";

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "managerId" TEXT;

-- AlterTable
ALTER TABLE "hr_request_types" ADD COLUMN     "autoGenerate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "companyId" TEXT NOT NULL;

-- DropTable
DROP TABLE "hr_requests";

-- CreateIndex
CREATE UNIQUE INDEX "hr_request_types_companyId_requestCode_key" ON "hr_request_types"("companyId", "requestCode");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_request_types" ADD CONSTRAINT "hr_request_types_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
