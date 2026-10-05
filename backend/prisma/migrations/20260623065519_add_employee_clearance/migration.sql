-- CreateTable
CREATE TABLE "employee_clearances" (
    "id" TEXT NOT NULL,
    "separationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_clearances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_clearance_items" (
    "id" TEXT NOT NULL,
    "clearanceId" TEXT NOT NULL,
    "clearanceType" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "clearedById" TEXT,
    "clearedDate" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_clearance_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_clearances_separationId_key" ON "employee_clearances"("separationId");

-- CreateIndex
CREATE INDEX "employee_clearance_items_clearanceId_idx" ON "employee_clearance_items"("clearanceId");

-- AddForeignKey
ALTER TABLE "employee_clearances" ADD CONSTRAINT "employee_clearances_separationId_fkey" FOREIGN KEY ("separationId") REFERENCES "employee_separations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_clearance_items" ADD CONSTRAINT "employee_clearance_items_clearanceId_fkey" FOREIGN KEY ("clearanceId") REFERENCES "employee_clearances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
