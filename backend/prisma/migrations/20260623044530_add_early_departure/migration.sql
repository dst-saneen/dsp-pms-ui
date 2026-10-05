-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "earlyDepartureMinutes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "employee_shifts" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
