-- Resumable tenant onboarding and server-generated codes.

CREATE TYPE "OrganizationOnboardingStatus" AS ENUM (
    'IN_PROGRESS',
    'COMPLETED'
);

CREATE TYPE "OrganizationOnboardingStep" AS ENUM (
    'ORGANIZATION',
    'COMPANY',
    'BRANCH',
    'STRUCTURE',
    'TEAM',
    'REVIEW',
    'COMPLETED'
);

ALTER TABLE "branches"
    ADD COLUMN "addressLine1" TEXT,
    ADD COLUMN "addressLine2" TEXT,
    ADD COLUMN "city" TEXT,
    ADD COLUMN "state" TEXT,
    ADD COLUMN "postalCode" TEXT,
    ADD COLUMN "countryCode" TEXT,
    ADD COLUMN "timezone" TEXT;

CREATE UNIQUE INDEX "branches_companyId_branchCode_key"
    ON "branches"("companyId", "branchCode");

CREATE UNIQUE INDEX "departments_branchId_departmentCode_key"
    ON "departments"("branchId", "departmentCode");

CREATE TABLE "organization_onboardings" (
    "id" TEXT NOT NULL,
    "companyGroupId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "status" "OrganizationOnboardingStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentStep" "OrganizationOnboardingStep" NOT NULL DEFAULT 'ORGANIZATION',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_onboardings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_onboardings_companyGroupId_key"
    ON "organization_onboardings"("companyGroupId");
CREATE INDEX "organization_onboardings_ownerUserId_idx"
    ON "organization_onboardings"("ownerUserId");
CREATE INDEX "organization_onboardings_status_idx"
    ON "organization_onboardings"("status");

ALTER TABLE "organization_onboardings"
    ADD CONSTRAINT "organization_onboardings_companyGroupId_fkey"
    FOREIGN KEY ("companyGroupId") REFERENCES "company_groups"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_onboardings"
    ADD CONSTRAINT "organization_onboardings_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing tenants are considered complete. New registrations create an IN_PROGRESS record.
INSERT INTO "organization_onboardings" (
    "id",
    "companyGroupId",
    "ownerUserId",
    "status",
    "currentStep",
    "completedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    md5('organization-onboarding:' || group_owner."companyGroupId"),
    group_owner."companyGroupId",
    group_owner."userId",
    'COMPLETED',
    'COMPLETED',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON (assignment."companyGroupId")
        assignment."companyGroupId",
        assignment."userId"
    FROM "user_role_assignments" assignment
    INNER JOIN "roles" role ON role."id" = assignment."roleId"
    WHERE
        assignment."companyGroupId" IS NOT NULL
        AND assignment."isActive" = true
        AND role."code" = 'ORGANIZATION_OWNER'
    ORDER BY assignment."companyGroupId", assignment."createdAt"
) group_owner;

CREATE TABLE "number_series" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "number_series_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "number_series_entityType_scopeKey_key"
    ON "number_series"("entityType", "scopeKey");

INSERT INTO "number_series" (
    "id", "entityType", "scopeKey", "prefix", "currentValue", "createdAt", "updatedAt"
)
SELECT
    md5('number-series:COMPANY_GROUP:GLOBAL'),
    'COMPANY_GROUP',
    'GLOBAL',
    'GRP',
    COALESCE(MAX(
        CASE WHEN "groupCode" ~ '^GRP-[0-9]+$'
            THEN substring("groupCode" FROM '[0-9]+$')::INTEGER
        END
    ), 0),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "company_groups"
UNION ALL
SELECT
    md5('number-series:COMPANY:GLOBAL'),
    'COMPANY',
    'GLOBAL',
    'COM',
    COALESCE(MAX(
        CASE WHEN "companyCode" ~ '^COM-[0-9]+$'
            THEN substring("companyCode" FROM '[0-9]+$')::INTEGER
        END
    ), 0),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "companies"
UNION ALL
SELECT
    md5('number-series:EMPLOYEE:GLOBAL'),
    'EMPLOYEE',
    'GLOBAL',
    'EMP',
    COALESCE(MAX(
        CASE WHEN "employeeCode" ~ '^EMP-[0-9]+$'
            THEN substring("employeeCode" FROM '[0-9]+$')::INTEGER
        END
    ), 0),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "employees";

INSERT INTO "number_series" (
    "id", "entityType", "scopeKey", "prefix", "currentValue", "createdAt", "updatedAt"
)
SELECT
    md5('number-series:BRANCH:' || "companyId"),
    'BRANCH',
    "companyId",
    'BR',
    COALESCE(MAX(
        CASE WHEN "branchCode" ~ '^BR-[0-9]+$'
            THEN substring("branchCode" FROM '[0-9]+$')::INTEGER
        END
    ), 0),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "branches" GROUP BY "companyId"
UNION ALL
SELECT
    md5('number-series:DEPARTMENT:' || "branchId"),
    'DEPARTMENT',
    "branchId",
    'DEP',
    COALESCE(MAX(
        CASE WHEN "departmentCode" ~ '^DEP-[0-9]+$'
            THEN substring("departmentCode" FROM '[0-9]+$')::INTEGER
        END
    ), 0),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "departments" GROUP BY "branchId"
UNION ALL
SELECT
    md5('number-series:DESIGNATION:' || "companyId"),
    'DESIGNATION',
    "companyId",
    'DES',
    COALESCE(MAX(
        CASE WHEN "designationCode" ~ '^DES-[0-9]+$'
            THEN substring("designationCode" FROM '[0-9]+$')::INTEGER
        END
    ), 0),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "designations" GROUP BY "companyId"
UNION ALL
SELECT
    md5('number-series:SHIFT:' || "companyId"),
    'SHIFT',
    "companyId",
    'SHF',
    COALESCE(MAX(
        CASE WHEN "shiftCode" ~ '^SHF-[0-9]+$'
            THEN substring("shiftCode" FROM '[0-9]+$')::INTEGER
        END
    ), 0),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "shifts" GROUP BY "companyId"
UNION ALL
SELECT
    md5('number-series:ASSET_CATEGORY:' || "companyId"),
    'ASSET_CATEGORY',
    "companyId",
    'AC',
    COALESCE(MAX(
        CASE WHEN "assetCategoryCode" ~ '^AC-[0-9]+$'
            THEN substring("assetCategoryCode" FROM '[0-9]+$')::INTEGER
        END
    ), 0),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "asset_categories" GROUP BY "companyId"
UNION ALL
SELECT
    md5('number-series:ASSET_TYPE:' || "companyId"),
    'ASSET_TYPE',
    "companyId",
    'AT',
    COALESCE(MAX(
        CASE WHEN "assetTypeCode" ~ '^AT-[0-9]+$'
            THEN substring("assetTypeCode" FROM '[0-9]+$')::INTEGER
        END
    ), 0),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "asset_types" GROUP BY "companyId"
UNION ALL
SELECT
    md5('number-series:ASSET:' || "companyId"),
    'ASSET',
    "companyId",
    'AST',
    COALESCE(MAX(
        CASE WHEN "assetCode" ~ '^AST-[0-9]+$'
            THEN substring("assetCode" FROM '[0-9]+$')::INTEGER
        END
    ), 0),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "assets" GROUP BY "companyId";
