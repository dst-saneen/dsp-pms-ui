-- AlterTable
ALTER TABLE "employee_separations" ADD COLUMN     "clearanceRemarks" TEXT,
ADD COLUMN     "completedById" TEXT,
ADD COLUMN     "completedDate" TIMESTAMP(3);
