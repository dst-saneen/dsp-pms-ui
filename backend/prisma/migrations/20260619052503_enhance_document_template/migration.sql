/*
  Warnings:

  - You are about to drop the `DocumentTemplate` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "DocumentTemplate";

-- CreateTable
CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "templateCode" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "templateContent" TEXT NOT NULL,
    "fileFormat" TEXT NOT NULL DEFAULT 'PDF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_templates_companyId_templateCode_key" ON "document_templates"("companyId", "templateCode");

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
