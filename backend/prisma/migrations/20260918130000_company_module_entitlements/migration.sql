-- Company-owned module availability replaces deployment-time tenant allowlists.
--
-- Every Company receives the baseline module set. Runtime reads still exclude
-- inactive Companies, while retaining their defaults for later reactivation.

CREATE TYPE "CompanyModuleCode" AS ENUM (
  'ASSETS',
  'DELIVERY',
  'FILE_STORAGE',
  'FINANCE',
  'ONBOARDING',
  'PAYROLL',
  'PROJECTS',
  'RECRUITMENT',
  'RECRUITMENT_SHORTLIST'
);

CREATE TABLE "company_module_entitlements" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "module" "CompanyModuleCode" NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "company_module_entitlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_module_entitlements_companyId_module_key"
  ON "company_module_entitlements"("companyId", "module");

CREATE INDEX "company_module_entitlements_companyId_isEnabled_idx"
  ON "company_module_entitlements"("companyId", "isEnabled");

CREATE INDEX "company_module_entitlements_module_isEnabled_idx"
  ON "company_module_entitlements"("module", "isEnabled");

ALTER TABLE "company_module_entitlements"
  ADD CONSTRAINT "company_module_entitlements_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Guarded, replay-safe default entitlement backfill. Deterministic IDs make
-- verification straightforward, while the unique key protects manual rows.
INSERT INTO "company_module_entitlements" (
  "id",
  "companyId",
  "module",
  "isEnabled",
  "createdAt",
  "updatedAt"
)
SELECT
  md5('company-module-entitlement:' || company."id" || ':' || defaults."module"::TEXT),
  company."id",
  defaults."module",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "companies" AS company
CROSS JOIN (
  VALUES
    ('ASSETS'::"CompanyModuleCode"),
    ('DELIVERY'::"CompanyModuleCode"),
    ('FILE_STORAGE'::"CompanyModuleCode"),
    ('FINANCE'::"CompanyModuleCode"),
    ('ONBOARDING'::"CompanyModuleCode"),
    ('PAYROLL'::"CompanyModuleCode"),
    ('PROJECTS'::"CompanyModuleCode"),
    ('RECRUITMENT'::"CompanyModuleCode"),
    ('RECRUITMENT_SHORTLIST'::"CompanyModuleCode")
) AS defaults("module")
ON CONFLICT ("companyId", "module") DO NOTHING;

CREATE OR REPLACE FUNCTION provision_company_module_entitlements()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO "company_module_entitlements" (
    "id",
    "companyId",
    "module",
    "isEnabled",
    "createdAt",
    "updatedAt"
  )
  SELECT
    md5('company-module-entitlement:' || NEW."id" || ':' || defaults."module"::TEXT),
    NEW."id",
    defaults."module",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM (
    VALUES
      ('ASSETS'::"CompanyModuleCode"),
      ('DELIVERY'::"CompanyModuleCode"),
      ('FILE_STORAGE'::"CompanyModuleCode"),
      ('FINANCE'::"CompanyModuleCode"),
      ('ONBOARDING'::"CompanyModuleCode"),
      ('PAYROLL'::"CompanyModuleCode"),
      ('PROJECTS'::"CompanyModuleCode"),
      ('RECRUITMENT'::"CompanyModuleCode"),
      ('RECRUITMENT_SHORTLIST'::"CompanyModuleCode")
  ) AS defaults("module")
  ON CONFLICT ("companyId", "module") DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "company_module_entitlements_after_insert" ON "companies";
CREATE TRIGGER "company_module_entitlements_after_insert"
AFTER INSERT ON "companies"
FOR EACH ROW
EXECUTE FUNCTION provision_company_module_entitlements();

DROP TRIGGER IF EXISTS "company_module_entitlements_after_activate" ON "companies";

-- Reconcile one more time after the INSERT trigger is installed. This closes
-- the deployment race where a Company was committed between the initial
-- backfill snapshot and trigger creation; explicit administrator choices are
-- preserved by the unique key and DO NOTHING conflict policy.
INSERT INTO "company_module_entitlements" (
  "id",
  "companyId",
  "module",
  "isEnabled",
  "createdAt",
  "updatedAt"
)
SELECT
  md5('company-module-entitlement:' || company."id" || ':' || defaults."module"::TEXT),
  company."id",
  defaults."module",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "companies" AS company
CROSS JOIN (
  VALUES
    ('ASSETS'::"CompanyModuleCode"),
    ('DELIVERY'::"CompanyModuleCode"),
    ('FILE_STORAGE'::"CompanyModuleCode"),
    ('FINANCE'::"CompanyModuleCode"),
    ('ONBOARDING'::"CompanyModuleCode"),
    ('PAYROLL'::"CompanyModuleCode"),
    ('PROJECTS'::"CompanyModuleCode"),
    ('RECRUITMENT'::"CompanyModuleCode"),
    ('RECRUITMENT_SHORTLIST'::"CompanyModuleCode")
) AS defaults("module")
ON CONFLICT ("companyId", "module") DO NOTHING;
