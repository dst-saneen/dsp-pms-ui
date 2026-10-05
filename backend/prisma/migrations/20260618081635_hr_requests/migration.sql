-- CreateTable
CREATE TABLE "hr_requests" (
    "id" TEXT NOT NULL,
    "requestNo" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requestTypeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,
    "approvalTransactionId" TEXT,
    "generatedFilePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hr_requests_requestNo_key" ON "hr_requests"("requestNo");

-- AddForeignKey
ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_requestTypeId_fkey" FOREIGN KEY ("requestTypeId") REFERENCES "hr_request_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
