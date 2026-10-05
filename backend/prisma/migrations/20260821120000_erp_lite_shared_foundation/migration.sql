-- ERP Lite shared foundation: Company financial profile, Business Party,
-- FINANCE_MANAGER role, Finance + Payroll permissions. Feature gates remain off.

CREATE TYPE "BusinessPartyType" AS ENUM ('CUSTOMER', 'VENDOR', 'BOTH', 'OTHER');

CREATE TABLE "company_financial_profiles" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "baseCurrencyCode" TEXT NOT NULL,
  "reportingStartDate" DATE NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_financial_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_financial_profiles_companyId_key"
  ON "company_financial_profiles"("companyId");

CREATE UNIQUE INDEX "company_financial_profiles_companyId_id_key"
  ON "company_financial_profiles"("companyId", "id");

ALTER TABLE "company_financial_profiles"
  ADD CONSTRAINT "company_financial_profiles_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "company_financial_profiles"
  ADD CONSTRAINT "company_financial_profiles_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "company_financial_profiles"
  ADD CONSTRAINT "company_financial_profiles_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "company_financial_profiles"
  ADD CONSTRAINT "company_financial_profiles_currency_chk"
  CHECK (char_length("baseCurrencyCode") = 3 AND "baseCurrencyCode" = upper("baseCurrencyCode"));

CREATE TABLE "business_parties" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "partyCode" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "partyType" "BusinessPartyType" NOT NULL,
  "contactPerson" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "taxRegistrationRef" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "archivedByUserId" TEXT,
  "archiveReason" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_parties_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_parties_companyId_partyCode_key"
  ON "business_parties"("companyId", "partyCode");

CREATE UNIQUE INDEX "business_parties_companyId_id_key"
  ON "business_parties"("companyId", "id");

CREATE INDEX "business_parties_companyId_isActive_idx"
  ON "business_parties"("companyId", "isActive");

CREATE INDEX "business_parties_companyId_normalizedName_idx"
  ON "business_parties"("companyId", "normalizedName");

ALTER TABLE "business_parties"
  ADD CONSTRAINT "business_parties_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_parties"
  ADD CONSTRAINT "business_parties_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_parties"
  ADD CONSTRAINT "business_parties_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_parties"
  ADD CONSTRAINT "business_parties_archivedByUserId_fkey"
  FOREIGN KEY ("archivedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "businessPartyId" TEXT;

CREATE INDEX IF NOT EXISTS "projects_companyId_businessPartyId_idx"
  ON "projects"("companyId", "businessPartyId");

-- Permissions
INSERT INTO "permissions" ("id", "code", "name", "description", "isTenantAssignable", "createdAt", "updatedAt")
VALUES
  (md5('permission:finance.transactions.read'), 'finance.transactions.read', 'View finance transactions', 'View Office Finance transactions and dashboards', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:finance.transactions.manage'), 'finance.transactions.manage', 'Manage finance transactions', 'Create and edit Office Finance draft transactions', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:finance.transactions.approve'), 'finance.transactions.approve', 'Approve finance transactions', 'Approve, reverse and reopen finance periods', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:finance.reports.read'), 'finance.reports.read', 'View finance reports', 'View Office Finance operational reports', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:finance.settings.manage'), 'finance.settings.manage', 'Manage finance settings', 'Manage financial profile, parties, categories, accounts and periods', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:payroll.payroll.approve'), 'payroll.payroll.approve', 'Approve payroll', 'Approve payroll runs and mark them paid', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:payroll.self.read'), 'payroll.self.read', 'View own payslips', 'List and download own paid payslips', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "isTenantAssignable" = EXCLUDED."isTenantAssignable",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Ensure existing payroll permissions are tenant-assignable
UPDATE "permissions"
SET "isTenantAssignable" = true, "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" IN ('payroll.payroll.read', 'payroll.payroll.manage');

INSERT INTO "roles" ("id", "code", "name", "description", "isSystem", "isActive", "updatedAt")
VALUES (
  '00000000-0000-4000-8000-000000000009',
  'FINANCE_MANAGER',
  'Finance Manager',
  'Manage Office Finance setup and approve finance and payroll payments.',
  true,
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "code" = EXCLUDED."code",
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "isSystem" = EXCLUDED."isSystem",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = CURRENT_TIMESTAMP;

WITH mappings("roleCode", "permissionCode") AS (
  VALUES
    ('ORGANIZATION_OWNER', 'finance.transactions.read'),
    ('ORGANIZATION_OWNER', 'finance.transactions.manage'),
    ('ORGANIZATION_OWNER', 'finance.transactions.approve'),
    ('ORGANIZATION_OWNER', 'finance.reports.read'),
    ('ORGANIZATION_OWNER', 'finance.settings.manage'),
    ('ORGANIZATION_OWNER', 'payroll.payroll.read'),
    ('ORGANIZATION_OWNER', 'payroll.payroll.manage'),
    ('ORGANIZATION_OWNER', 'payroll.payroll.approve'),
    ('ORGANIZATION_OWNER', 'payroll.self.read'),
    ('COMPANY_ADMINISTRATOR', 'finance.transactions.read'),
    ('COMPANY_ADMINISTRATOR', 'finance.transactions.manage'),
    ('COMPANY_ADMINISTRATOR', 'finance.transactions.approve'),
    ('COMPANY_ADMINISTRATOR', 'finance.reports.read'),
    ('COMPANY_ADMINISTRATOR', 'finance.settings.manage'),
    ('COMPANY_ADMINISTRATOR', 'payroll.payroll.read'),
    ('COMPANY_ADMINISTRATOR', 'payroll.payroll.manage'),
    ('COMPANY_ADMINISTRATOR', 'payroll.payroll.approve'),
    ('FINANCE_MANAGER', 'finance.transactions.read'),
    ('FINANCE_MANAGER', 'finance.transactions.manage'),
    ('FINANCE_MANAGER', 'finance.transactions.approve'),
    ('FINANCE_MANAGER', 'finance.reports.read'),
    ('FINANCE_MANAGER', 'finance.settings.manage'),
    ('FINANCE_MANAGER', 'payroll.payroll.read'),
    ('FINANCE_MANAGER', 'payroll.payroll.approve'),
    ('HR_MANAGER', 'payroll.payroll.read'),
    ('HR_MANAGER', 'payroll.payroll.manage'),
    ('EMPLOYEE', 'payroll.self.read')
)
INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT
  md5('role-permission:' || m."roleCode" || ':' || m."permissionCode"),
  r."id",
  p."id"
FROM mappings m
JOIN "roles" r ON r."code" = m."roleCode"
JOIN "permissions" p ON p."code" = m."permissionCode"
ON CONFLICT DO NOTHING;
