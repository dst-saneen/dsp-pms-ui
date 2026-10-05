/*
  Warnings:

  - Added the required column `payrollMonth` to the `PayrollRunEmployee` table without a default value. This is not possible if the table is not empty.
  - Added the required column `payrollYear` to the `PayrollRunEmployee` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PayrollRunEmployee" ADD COLUMN     "payrollMonth" INTEGER NOT NULL,
ADD COLUMN     "payrollYear" INTEGER NOT NULL,
ADD COLUMN     "remarks" TEXT;
