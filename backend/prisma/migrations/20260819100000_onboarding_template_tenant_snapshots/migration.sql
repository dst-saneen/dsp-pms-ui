-- Additive Template tenant snapshots. Do not rewrite 20260818120100.
-- Columns are nullable until backfill; new writes populate them from the parent hierarchy.

ALTER TABLE "OnboardingDepartmentTemplate"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT,
  ADD COLUMN IF NOT EXISTS "branchId" TEXT,
  ADD COLUMN IF NOT EXISTS "rowVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "OnboardingTaskGroup"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT,
  ADD COLUMN IF NOT EXISTS "onboardingTemplateVersionId" TEXT,
  ADD COLUMN IF NOT EXISTS "rowVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "OnboardingTemplateTask"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT,
  ADD COLUMN IF NOT EXISTS "onboardingTemplateVersionId" TEXT,
  ADD COLUMN IF NOT EXISTS "rowVersion" INTEGER NOT NULL DEFAULT 1;

-- Deterministic snapshot backfill. Stops short of mutating published business content.
UPDATE "OnboardingTemplateVersion" v
SET "companyId" = t."companyId"
FROM "OnboardingTemplate" t
WHERE v."onboardingTemplateId" = t.id
  AND v."companyId" IS NULL;

UPDATE "OnboardingDepartmentTemplate" AS d
SET
  "companyId" = t."companyId",
  "branchId" = dep."branchId"
FROM "OnboardingTemplateVersion" AS v,
     "OnboardingTemplate" AS t,
     "departments" AS dep
WHERE d."onboardingTemplateVersionId" = v.id
  AND t.id = v."onboardingTemplateId"
  AND dep.id = d."departmentId"
  AND t."companyId" = dep."companyId"
  AND (d."companyId" IS NULL OR d."branchId" IS NULL);

UPDATE "OnboardingTaskGroup" g
SET
  "companyId" = d."companyId",
  "onboardingTemplateVersionId" = d."onboardingTemplateVersionId"
FROM "OnboardingDepartmentTemplate" d
WHERE g."onboardingDepartmentTemplateId" = d.id
  AND (g."companyId" IS NULL OR g."onboardingTemplateVersionId" IS NULL);

UPDATE "OnboardingTemplateTask" task
SET
  "companyId" = g."companyId",
  "onboardingTemplateVersionId" = g."onboardingTemplateVersionId"
FROM "OnboardingTaskGroup" g
WHERE task."taskGroupId" = g.id
  AND (task."companyId" IS NULL OR task."onboardingTemplateVersionId" IS NULL);

CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingDepartmentTemplate_companyId_id_key"
  ON "OnboardingDepartmentTemplate" ("companyId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingDepartmentTemplate_co_ver_id_key"
  ON "OnboardingDepartmentTemplate" ("companyId", "onboardingTemplateVersionId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingDepartmentTemplate_co_ver_dept_key"
  ON "OnboardingDepartmentTemplate" ("companyId", "onboardingTemplateVersionId", "departmentId");

CREATE INDEX IF NOT EXISTS "OnboardingDepartmentTemplate_companyId_idx"
  ON "OnboardingDepartmentTemplate" ("companyId");

CREATE INDEX IF NOT EXISTS "OnboardingDepartmentTemplate_branchId_idx"
  ON "OnboardingDepartmentTemplate" ("branchId");

CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingTaskGroup_companyId_id_key"
  ON "OnboardingTaskGroup" ("companyId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingTaskGroup_co_ver_id_key"
  ON "OnboardingTaskGroup" ("companyId", "onboardingTemplateVersionId", "id");

CREATE INDEX IF NOT EXISTS "OnboardingTaskGroup_companyId_idx"
  ON "OnboardingTaskGroup" ("companyId");

CREATE INDEX IF NOT EXISTS "OnboardingTaskGroup_onboardingTemplateVersionId_idx"
  ON "OnboardingTaskGroup" ("onboardingTemplateVersionId");

CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingTemplateTask_companyId_id_key"
  ON "OnboardingTemplateTask" ("companyId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingTemplateTask_co_ver_id_key"
  ON "OnboardingTemplateTask" ("companyId", "onboardingTemplateVersionId", "id");

CREATE INDEX IF NOT EXISTS "OnboardingTemplateTask_companyId_idx"
  ON "OnboardingTemplateTask" ("companyId");

CREATE INDEX IF NOT EXISTS "OnboardingTemplateTask_onboardingTemplateVersionId_idx"
  ON "OnboardingTemplateTask" ("onboardingTemplateVersionId");

CREATE INDEX IF NOT EXISTS "OnboardingTemplateVersion_companyId_idx"
  ON "OnboardingTemplateVersion" ("companyId");
