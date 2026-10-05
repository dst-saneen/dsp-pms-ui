CREATE UNIQUE INDEX IF NOT EXISTS "employee_assets_companyId_sourceCommandKey_uq"
  ON "employee_assets" ("companyId", "sourceCommandKey")
  WHERE "sourceCommandKey" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "software_license_allocations_companyId_sourceCommandKey_uq"
  ON "software_license_allocations" ("companyId", "sourceCommandKey")
  WHERE "sourceCommandKey" IS NOT NULL;
