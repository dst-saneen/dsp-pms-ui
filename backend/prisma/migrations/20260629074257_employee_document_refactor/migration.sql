/*
  Warnings:

  - You are about to drop the column `filePath` on the `employee_documents` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `employee_documents` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[companyId,documentCode]` on the table `employee_document_types` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,categoryId,documentName]` on the table `employee_document_types` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `categoryId` to the `employee_document_types` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `employee_documents` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "employee_document_types" ADD COLUMN     "categoryId" TEXT NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "lifetimeAllowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "requiresDocumentNumber" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresExpiry" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresVerification" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "employee_documents" DROP COLUMN "filePath",
DROP COLUMN "status",
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "lifetimeDocument" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "originalFileName" TEXT,
ADD COLUMN     "storageProvider" TEXT,
ADD COLUMN     "storageReference" TEXT,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "verifiedBy" TEXT,
ADD COLUMN     "verifiedDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "employee_document_categories" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "categoryCode" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_document_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_document_categories_companyId_idx" ON "employee_document_categories"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_document_categories_companyId_categoryCode_key" ON "employee_document_categories"("companyId", "categoryCode");

-- CreateIndex
CREATE UNIQUE INDEX "employee_document_categories_companyId_categoryName_key" ON "employee_document_categories"("companyId", "categoryName");

-- CreateIndex
CREATE INDEX "employee_document_types_categoryId_idx" ON "employee_document_types"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_document_types_companyId_documentCode_key" ON "employee_document_types"("companyId", "documentCode");

-- CreateIndex
CREATE UNIQUE INDEX "employee_document_types_companyId_categoryId_documentName_key" ON "employee_document_types"("companyId", "categoryId", "documentName");

-- CreateIndex
CREATE INDEX "employee_documents_verificationStatus_idx" ON "employee_documents"("verificationStatus");

-- AddForeignKey
ALTER TABLE "employee_document_types" ADD CONSTRAINT "employee_document_types_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "employee_document_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_document_categories" ADD CONSTRAINT "employee_document_categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
