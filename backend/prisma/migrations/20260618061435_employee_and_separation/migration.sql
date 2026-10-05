-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "employmentStatus" TEXT NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "employee_separations" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "separationType" TEXT NOT NULL,
    "resignationDate" TIMESTAMP(3),
    "lastWorkingDate" TIMESTAMP(3),
    "reason" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_separations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "employee_separations" ADD CONSTRAINT "employee_separations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
