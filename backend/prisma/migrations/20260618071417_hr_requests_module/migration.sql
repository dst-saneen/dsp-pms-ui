-- CreateTable
CREATE TABLE "hr_request_types" (
    "id" TEXT NOT NULL,
    "requestCode" TEXT NOT NULL,
    "requestName" TEXT NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_request_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_request_templates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requestTypeId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "templateBody" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_request_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_requests" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requestTypeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "generatedFileUrl" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hr_request_types_requestCode_key" ON "hr_request_types"("requestCode");

-- CreateIndex
CREATE INDEX "hr_requests_employeeId_idx" ON "hr_requests"("employeeId");

-- CreateIndex
CREATE INDEX "hr_requests_status_idx" ON "hr_requests"("status");

-- AddForeignKey
ALTER TABLE "hr_request_templates" ADD CONSTRAINT "hr_request_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_request_templates" ADD CONSTRAINT "hr_request_templates_requestTypeId_fkey" FOREIGN KEY ("requestTypeId") REFERENCES "hr_request_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_requestTypeId_fkey" FOREIGN KEY ("requestTypeId") REFERENCES "hr_request_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
