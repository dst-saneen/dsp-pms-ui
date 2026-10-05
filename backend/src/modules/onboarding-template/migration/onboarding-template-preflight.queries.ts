export const ONBOARDING_TEMPLATE_PREFLIGHT_ID_LIMIT = 200;

export type OnboardingTemplateFindingCode =
  | 'DUPLICATE_CURRENT_PUBLISHED'
  | 'VERSION_COMPANY_MISMATCH'
  | 'DEPARTMENT_SLICE_MISSING_PARENT'
  | 'DEPARTMENT_SLICE_COMPANY_MISMATCH'
  | 'DEPARTMENT_SLICE_BRANCH_MISMATCH'
  | 'DEPARTMENT_SLICE_DUPLICATE'
  | 'TASK_GROUP_ORPHAN'
  | 'TASK_GROUP_CONTAINMENT_MISMATCH'
  | 'TEMPLATE_TASK_ORPHAN'
  | 'TEMPLATE_TASK_CONTAINMENT_MISMATCH'
  | 'TEMPLATE_TASK_ROOT_MISMATCH'
  | 'DEPENDENCY_FOREIGN_VERSION'
  | 'PUBLISH_DEPENDENCY_CYCLE'
  | 'PUBLISH_SKIPPABLE_PREREQUISITE'
  | 'PUBLISH_GENERIC_AUTOMATION'
  | 'PUBLISH_DEPARTMENT_SLICE_APPROVAL'
  | 'ASSIGNMENT_BRANCH_TEMPLATE_INCOMPATIBLE'
  | 'DUPLICATE_TASK_SEQUENCE'
  | 'DUPLICATE_TASK_NAME'
  | 'PUBLISH_NULL_OWNER'
  | 'PUBLISH_LEGACY_OWNER'
  | 'PUBLISH_NAMED_ASSIGNMENT'
  | 'PUBLISH_DEPARTMENT_OWNER_MISMATCH'
  | 'PUBLISH_UNSUPPORTED_WORK_TYPE'
  | 'PUBLISH_APPROVAL_PRESENT'
  | 'PUBLISH_ASSET_INVALID'
  | 'ASSIGNMENT_OVERLAP_DEFAULT'
  | 'ASSIGNMENT_OVERLAP_BRANCH'
  | 'ASSIGNMENT_BRANCH_COMPANY_MISMATCH'
  | 'ASSIGNMENT_TEMPLATE_COMPANY_MISMATCH'
  | 'ASSIGNMENT_EFFECTIVE_DATES_INVALID'
  | 'ASSIGNMENT_INACTIVE_MISSING_EVIDENCE';

export interface OnboardingTemplatePreflightColumn {
  table: string;
  column: string;
}

export interface OnboardingTemplateSqlCheck {
  code: OnboardingTemplateFindingCode;
  sql: string;
  requiredColumns?: readonly OnboardingTemplatePreflightColumn[];
  fallbackSql?: string;
}

export type PreflightColumnSet = ReadonlySet<string>;

export function preflightColumnKey(table: string, column: string): string {
  return `${table}.${column}`;
}

export const ONBOARDING_TEMPLATE_PREFLIGHT_PROBE_COLUMNS: readonly OnboardingTemplatePreflightColumn[] =
  [
    { table: 'OnboardingTemplateVersion', column: 'companyId' },
    { table: 'OnboardingDepartmentTemplate', column: 'companyId' },
    { table: 'OnboardingDepartmentTemplate', column: 'branchId' },
    { table: 'OnboardingTaskGroup', column: 'companyId' },
    { table: 'OnboardingTaskGroup', column: 'onboardingTemplateVersionId' },
    { table: 'OnboardingTemplateTask', column: 'companyId' },
    { table: 'OnboardingTemplateTask', column: 'onboardingTemplateVersionId' },
    { table: 'designation_onboarding_assignments', column: 'companyId' },
    { table: 'designation_onboarding_assignments', column: 'deactivatedAt' },
    {
      table: 'designation_onboarding_assignments',
      column: 'deactivatedByUserId',
    },
  ];

export interface ResolvedOnboardingTemplateSqlCheck {
  code: OnboardingTemplateFindingCode;
  sql: string;
  skipped: boolean;
  usedFallback: boolean;
  skipReason?: string;
}

function hasRequiredColumns(
  columns: PreflightColumnSet,
  required: readonly OnboardingTemplatePreflightColumn[] | undefined,
): boolean {
  if (!required?.length) {
    return true;
  }
  return required.every((item) =>
    columns.has(preflightColumnKey(item.table, item.column)),
  );
}

export function resolveOnboardingTemplatePreflightChecks(
  columns: PreflightColumnSet,
): ResolvedOnboardingTemplateSqlCheck[] {
  return ONBOARDING_TEMPLATE_PREFLIGHT_CHECKS.map((check) => {
    if (hasRequiredColumns(columns, check.requiredColumns)) {
      return {
        code: check.code,
        sql: check.sql,
        skipped: false,
        usedFallback: false,
      };
    }
    if (check.fallbackSql) {
      return {
        code: check.code,
        sql: check.fallbackSql,
        skipped: false,
        usedFallback: true,
      };
    }
    return {
      code: check.code,
      sql: check.sql,
      skipped: true,
      usedFallback: false,
      skipReason: `missing ${(check.requiredColumns ?? [])
        .map((item) => preflightColumnKey(item.table, item.column))
        .join(', ')}`,
    };
  });
}

function idSelect(sql: string): string {
  return `${sql.trim().replace(/;+\s*$/, '')} LIMIT ${ONBOARDING_TEMPLATE_PREFLIGHT_ID_LIMIT}`;
}

export const ONBOARDING_TEMPLATE_PREFLIGHT_CHECKS: readonly OnboardingTemplateSqlCheck[] =
  [
    {
      code: 'DUPLICATE_CURRENT_PUBLISHED',
      sql: idSelect(`
        SELECT v."onboardingTemplateId" AS id
        FROM "OnboardingTemplateVersion" v
        WHERE v.status = 'PUBLISHED' AND v."isCurrent" = true
        GROUP BY v."onboardingTemplateId"
        HAVING count(*) > 1
      `),
    },
    {
      code: 'VERSION_COMPANY_MISMATCH',
      requiredColumns: [
        { table: 'OnboardingTemplateVersion', column: 'companyId' },
      ],
      sql: idSelect(`
        SELECT v.id
        FROM "OnboardingTemplateVersion" v
        JOIN "OnboardingTemplate" t ON t.id = v."onboardingTemplateId"
        WHERE v."companyId" IS NULL OR v."companyId" <> t."companyId"
      `),
    },
    {
      code: 'DEPARTMENT_SLICE_MISSING_PARENT',
      sql: idSelect(`
        SELECT d.id
        FROM "OnboardingDepartmentTemplate" d
        LEFT JOIN "OnboardingTemplateVersion" v ON v.id = d."onboardingTemplateVersionId"
        LEFT JOIN "departments" dep ON dep.id = d."departmentId"
        WHERE v.id IS NULL OR dep.id IS NULL
      `),
    },
    {
      code: 'DEPARTMENT_SLICE_COMPANY_MISMATCH',
      sql: idSelect(`
        SELECT d.id
        FROM "OnboardingDepartmentTemplate" d
        JOIN "OnboardingTemplateVersion" v ON v.id = d."onboardingTemplateVersionId"
        JOIN "OnboardingTemplate" t ON t.id = v."onboardingTemplateId"
        JOIN "departments" dep ON dep.id = d."departmentId"
        WHERE t."companyId" <> dep."companyId"
      `),
    },
    {
      code: 'DEPARTMENT_SLICE_BRANCH_MISMATCH',
      requiredColumns: [
        { table: 'OnboardingDepartmentTemplate', column: 'branchId' },
      ],
      sql: idSelect(`
        SELECT d.id
        FROM "OnboardingDepartmentTemplate" d
        JOIN "departments" dep ON dep.id = d."departmentId"
        WHERE d."branchId" IS NOT NULL AND d."branchId" <> dep."branchId"
      `),
      fallbackSql: idSelect(`
        SELECT min(d.id) AS id
        FROM "OnboardingDepartmentTemplate" d
        JOIN "departments" dep ON dep.id = d."departmentId"
        GROUP BY d."onboardingTemplateVersionId"
        HAVING count(DISTINCT dep."branchId") > 1
      `),
    },
    {
      code: 'DEPARTMENT_SLICE_DUPLICATE',
      sql: idSelect(`
        SELECT min(d.id) AS id
        FROM "OnboardingDepartmentTemplate" d
        GROUP BY d."onboardingTemplateVersionId", d."departmentId"
        HAVING count(*) > 1
      `),
    },
    {
      code: 'TASK_GROUP_ORPHAN',
      sql: idSelect(`
        SELECT g.id
        FROM "OnboardingTaskGroup" g
        LEFT JOIN "OnboardingDepartmentTemplate" d
          ON d.id = g."onboardingDepartmentTemplateId"
        WHERE d.id IS NULL
      `),
    },
    {
      code: 'TASK_GROUP_CONTAINMENT_MISMATCH',
      requiredColumns: [
        { table: 'OnboardingTaskGroup', column: 'companyId' },
        { table: 'OnboardingTaskGroup', column: 'onboardingTemplateVersionId' },
        { table: 'OnboardingDepartmentTemplate', column: 'companyId' },
      ],
      sql: idSelect(`
        SELECT g.id
        FROM "OnboardingTaskGroup" g
        JOIN "OnboardingDepartmentTemplate" d
          ON d.id = g."onboardingDepartmentTemplateId"
        WHERE g."companyId" IS DISTINCT FROM d."companyId"
           OR g."onboardingTemplateVersionId" IS DISTINCT FROM d."onboardingTemplateVersionId"
      `),
    },
    {
      code: 'TEMPLATE_TASK_ORPHAN',
      sql: idSelect(`
        SELECT task.id
        FROM "OnboardingTemplateTask" task
        LEFT JOIN "OnboardingTaskGroup" g ON g.id = task."taskGroupId"
        WHERE g.id IS NULL
      `),
    },
    {
      code: 'TEMPLATE_TASK_CONTAINMENT_MISMATCH',
      requiredColumns: [
        { table: 'OnboardingTemplateTask', column: 'companyId' },
        {
          table: 'OnboardingTemplateTask',
          column: 'onboardingTemplateVersionId',
        },
        { table: 'OnboardingTaskGroup', column: 'companyId' },
        { table: 'OnboardingTaskGroup', column: 'onboardingTemplateVersionId' },
      ],
      sql: idSelect(`
        SELECT task.id
        FROM "OnboardingTemplateTask" task
        JOIN "OnboardingTaskGroup" g ON g.id = task."taskGroupId"
        WHERE task."companyId" IS DISTINCT FROM g."companyId"
           OR task."onboardingTemplateVersionId" IS DISTINCT FROM g."onboardingTemplateVersionId"
      `),
    },
    {
      code: 'TEMPLATE_TASK_ROOT_MISMATCH',
      sql: idSelect(`
        SELECT task.id
        FROM "OnboardingTemplateTask" task
        JOIN "OnboardingTaskGroup" g ON g.id = task."taskGroupId"
        JOIN "OnboardingDepartmentTemplate" d ON d.id = g."onboardingDepartmentTemplateId"
        JOIN "OnboardingTemplateVersion" v ON v.id = d."onboardingTemplateVersionId"
        WHERE task."onboardingTemplateId" IS NOT NULL
          AND task."onboardingTemplateId" <> v."onboardingTemplateId"
      `),
    },
    {
      code: 'DEPENDENCY_FOREIGN_VERSION',
      requiredColumns: [
        { table: 'OnboardingTemplateTask', column: 'companyId' },
        {
          table: 'OnboardingTemplateTask',
          column: 'onboardingTemplateVersionId',
        },
      ],
      sql: idSelect(`
        SELECT task.id
        FROM "OnboardingTemplateTask" task
        JOIN "OnboardingTemplateTask" dep ON dep.id = task."dependsOnTaskId"
        WHERE task."dependsOnTaskId" IS NOT NULL
          AND (
            task."onboardingTemplateVersionId" IS DISTINCT FROM dep."onboardingTemplateVersionId"
            OR task."companyId" IS DISTINCT FROM dep."companyId"
          )
      `),
      fallbackSql: idSelect(`
        SELECT task.id
        FROM "OnboardingTemplateTask" task
        JOIN "OnboardingTemplateTask" dep ON dep.id = task."dependsOnTaskId"
        JOIN "OnboardingTaskGroup" g ON g.id = task."taskGroupId"
        JOIN "OnboardingDepartmentTemplate" d ON d.id = g."onboardingDepartmentTemplateId"
        JOIN "OnboardingTaskGroup" dep_g ON dep_g.id = dep."taskGroupId"
        JOIN "OnboardingDepartmentTemplate" dep_d
          ON dep_d.id = dep_g."onboardingDepartmentTemplateId"
        WHERE task."dependsOnTaskId" IS NOT NULL
          AND d."onboardingTemplateVersionId" IS DISTINCT FROM dep_d."onboardingTemplateVersionId"
      `),
    },
    {
      code: 'PUBLISH_DEPENDENCY_CYCLE',
      requiredColumns: [
        {
          table: 'OnboardingTemplateTask',
          column: 'onboardingTemplateVersionId',
        },
      ],
      sql: idSelect(`
        WITH RECURSIVE chain AS (
          SELECT
            task.id AS start_id,
            task.id AS current_id,
            task."dependsOnTaskId" AS next_id,
            ARRAY[task.id]::text[] AS path
          FROM "OnboardingTemplateTask" task
          JOIN "OnboardingTemplateVersion" v
            ON v.id = task."onboardingTemplateVersionId"
          WHERE v.status = 'PUBLISHED'
            AND v."isCurrent" = true
            AND task."dependsOnTaskId" IS NOT NULL
          UNION ALL
          SELECT
            chain.start_id,
            dep.id,
            dep."dependsOnTaskId",
            chain.path || dep.id
          FROM chain
          JOIN "OnboardingTemplateTask" dep ON dep.id = chain.next_id
          WHERE chain.next_id IS NOT NULL
            AND NOT dep.id = ANY(chain.path)
        )
        SELECT DISTINCT start_id AS id
        FROM chain
        WHERE next_id IS NOT NULL
          AND next_id = ANY(path)
      `),
      fallbackSql: idSelect(`
        WITH RECURSIVE chain AS (
          SELECT
            task.id AS start_id,
            task.id AS current_id,
            task."dependsOnTaskId" AS next_id,
            ARRAY[task.id]::text[] AS path
          FROM "OnboardingTemplateTask" task
          JOIN "OnboardingTaskGroup" g ON g.id = task."taskGroupId"
          JOIN "OnboardingDepartmentTemplate" d ON d.id = g."onboardingDepartmentTemplateId"
          JOIN "OnboardingTemplateVersion" v ON v.id = d."onboardingTemplateVersionId"
          WHERE v.status = 'PUBLISHED'
            AND v."isCurrent" = true
            AND task."dependsOnTaskId" IS NOT NULL
          UNION ALL
          SELECT
            chain.start_id,
            dep.id,
            dep."dependsOnTaskId",
            chain.path || dep.id
          FROM chain
          JOIN "OnboardingTemplateTask" dep ON dep.id = chain.next_id
          WHERE chain.next_id IS NOT NULL
            AND NOT dep.id = ANY(chain.path)
        )
        SELECT DISTINCT start_id AS id
        FROM chain
        WHERE next_id IS NOT NULL
          AND next_id = ANY(path)
      `),
    },
    {
      code: 'PUBLISH_SKIPPABLE_PREREQUISITE',
      requiredColumns: [
        {
          table: 'OnboardingTemplateTask',
          column: 'onboardingTemplateVersionId',
        },
      ],
      sql: idSelect(`
        SELECT task.id
        FROM "OnboardingTemplateTask" task
        JOIN "OnboardingTemplateTask" dep ON dep.id = task."dependsOnTaskId"
        JOIN "OnboardingTemplateVersion" v
          ON v.id = task."onboardingTemplateVersionId"
        WHERE v.status = 'PUBLISHED' AND v."isCurrent" = true
          AND dep."allowSkip" = true
      `),
      fallbackSql: idSelect(`
        SELECT task.id
        FROM "OnboardingTemplateTask" task
        JOIN "OnboardingTemplateTask" dep ON dep.id = task."dependsOnTaskId"
        JOIN "OnboardingTaskGroup" g ON g.id = task."taskGroupId"
        JOIN "OnboardingDepartmentTemplate" d ON d.id = g."onboardingDepartmentTemplateId"
        JOIN "OnboardingTemplateVersion" v ON v.id = d."onboardingTemplateVersionId"
        WHERE v.status = 'PUBLISHED' AND v."isCurrent" = true
          AND dep."allowSkip" = true
      `),
    },
    {
      code: 'PUBLISH_GENERIC_AUTOMATION',
      requiredColumns: [
        {
          table: 'OnboardingTemplateTask',
          column: 'onboardingTemplateVersionId',
        },
      ],
      sql: idSelect(`
        SELECT task.id
        FROM "OnboardingTemplateTask" task
        JOIN "OnboardingTemplateVersion" v
          ON v.id = task."onboardingTemplateVersionId"
        WHERE v.status = 'PUBLISHED' AND v."isCurrent" = true
          AND task."autoComplete" = true
      `),
      fallbackSql: idSelect(`
        SELECT task.id
        FROM "OnboardingTemplateTask" task
        JOIN "OnboardingTaskGroup" g ON g.id = task."taskGroupId"
        JOIN "OnboardingDepartmentTemplate" d ON d.id = g."onboardingDepartmentTemplateId"
        JOIN "OnboardingTemplateVersion" v ON v.id = d."onboardingTemplateVersionId"
        WHERE v.status = 'PUBLISHED' AND v."isCurrent" = true
          AND task."autoComplete" = true
      `),
    },
    {
      code: 'PUBLISH_DEPARTMENT_SLICE_APPROVAL',
      requiredColumns: [
        { table: 'OnboardingDepartmentTemplate', column: 'companyId' },
      ],
      sql: idSelect(`
        SELECT d.id
        FROM "OnboardingDepartmentTemplate" d
        JOIN "OnboardingTemplateVersion" v
          ON v.id = d."onboardingTemplateVersionId"
        WHERE v.status = 'PUBLISHED' AND v."isCurrent" = true
          AND d."approvalWorkflowId" IS NOT NULL
      `),
    },
    {
      code: 'DUPLICATE_TASK_SEQUENCE',
      sql: idSelect(`
        SELECT min(task.id) AS id
        FROM "OnboardingTemplateTask" task
        GROUP BY task."taskGroupId", task."sequenceNo"
        HAVING count(*) > 1
      `),
    },
    {
      code: 'DUPLICATE_TASK_NAME',
      sql: idSelect(`
        SELECT min(task.id) AS id
        FROM "OnboardingTemplateTask" task
        GROUP BY task."taskGroupId", task."taskName"
        HAVING count(*) > 1
      `),
    },
    {
      code: 'PUBLISH_NULL_OWNER',
      requiredColumns: [
        {
          table: 'OnboardingTemplateTask',
          column: 'onboardingTemplateVersionId',
        },
      ],
      sql: idSelect(`
        SELECT task.id
        FROM "OnboardingTemplateTask" task
        JOIN "OnboardingTemplateVersion" v
          ON v.id = task."onboardingTemplateVersionId"
        WHERE v.status = 'PUBLISHED' AND v."isCurrent" = true
          AND task."ownerType" IS NULL
      `),
      fallbackSql: idSelect(`
        SELECT task.id
        FROM "OnboardingTemplateTask" task
        JOIN "OnboardingTaskGroup" g ON g.id = task."taskGroupId"
        JOIN "OnboardingDepartmentTemplate" d ON d.id = g."onboardingDepartmentTemplateId"
        JOIN "OnboardingTemplateVersion" v ON v.id = d."onboardingTemplateVersionId"
        WHERE v.status = 'PUBLISHED' AND v."isCurrent" = true
          AND task."ownerType" IS NULL
      `),
    },
    {
      code: 'PUBLISH_LEGACY_OWNER',
      requiredColumns: [
        {
          table: 'OnboardingTemplateTask',
          column: 'onboardingTemplateVersionId',
        },
      ],
      sql: idSelect(`
        SELECT task.id
        FROM "OnboardingTemplateTask" task
        JOIN "OnboardingTemplateVersion" v
          ON v.id = task."onboardingTemplateVersionId"
        WHERE v.status = 'PUBLISHED' AND v."isCurrent" = true
          AND task."ownerType" IN ('HR', 'IT', 'FINANCE', 'ADMIN', 'SYSTEM')
      `),
      fallbackSql: idSelect(`
        SELECT task.id
        FROM "OnboardingTemplateTask" task
        JOIN "OnboardingTaskGroup" g ON g.id = task."taskGroupId"
        JOIN "OnboardingDepartmentTemplate" d ON d.id = g."onboardingDepartmentTemplateId"
        JOIN "OnboardingTemplateVersion" v ON v.id = d."onboardingTemplateVersionId"
        WHERE v.status = 'PUBLISHED' AND v."isCurrent" = true
          AND task."ownerType" IN ('HR', 'IT', 'FINANCE', 'ADMIN', 'SYSTEM')
      `),
    },
    {
      code: 'PUBLISH_NAMED_ASSIGNMENT',
      requiredColumns: [
        {
          table: 'OnboardingTemplateTask',
          column: 'onboardingTemplateVersionId',
        },
      ],
      sql: idSelect(`
        SELECT task.id
        FROM "OnboardingTemplateTask" task
        JOIN "OnboardingTemplateVersion" v
          ON v.id = task."onboardingTemplateVersionId"
        WHERE v.status = 'PUBLISHED' AND v."isCurrent" = true
          AND (task."assignedEmployeeId" IS NOT NULL OR task."assignedDesignationId" IS NOT NULL)
      `),
      fallbackSql: idSelect(`
        SELECT task.id
        FROM "OnboardingTemplateTask" task
        JOIN "OnboardingTaskGroup" g ON g.id = task."taskGroupId"
        JOIN "OnboardingDepartmentTemplate" d ON d.id = g."onboardingDepartmentTemplateId"
        JOIN "OnboardingTemplateVersion" v ON v.id = d."onboardingTemplateVersionId"
        WHERE v.status = 'PUBLISHED' AND v."isCurrent" = true
          AND (task."assignedEmployeeId" IS NOT NULL OR task."assignedDesignationId" IS NOT NULL)
      `),
    },
    {
      code: 'PUBLISH_DEPARTMENT_OWNER_MISMATCH',
      sql: idSelect(`
        SELECT task.id
        FROM "OnboardingTemplateTask" task
        JOIN "OnboardingTaskGroup" g ON g.id = task."taskGroupId"
        JOIN "OnboardingDepartmentTemplate" d ON d.id = g."onboardingDepartmentTemplateId"
        JOIN "OnboardingTemplateVersion" v ON v.id = d."onboardingTemplateVersionId"
        WHERE v.status = 'PUBLISHED' AND v."isCurrent" = true
          AND task."ownerType" = 'DEPARTMENT'
          AND (
            task."assignedDepartmentId" IS NULL
            OR task."assignedDepartmentId" <> d."departmentId"
          )
      `),
    },
    {
      code: 'PUBLISH_UNSUPPORTED_WORK_TYPE',
      requiredColumns: [
        {
          table: 'OnboardingTemplateTask',
          column: 'onboardingTemplateVersionId',
        },
      ],
      sql: idSelect(`
        SELECT task.id
        FROM "OnboardingTemplateTask" task
        JOIN "OnboardingTemplateVersion" v
          ON v.id = task."onboardingTemplateVersionId"
        WHERE v.status = 'PUBLISHED' AND v."isCurrent" = true
          AND task."workType" NOT IN ('CHECKLIST', 'ASSET')
      `),
      fallbackSql: idSelect(`
        SELECT task.id
        FROM "OnboardingTemplateTask" task
        JOIN "OnboardingTaskGroup" g ON g.id = task."taskGroupId"
        JOIN "OnboardingDepartmentTemplate" d ON d.id = g."onboardingDepartmentTemplateId"
        JOIN "OnboardingTemplateVersion" v ON v.id = d."onboardingTemplateVersionId"
        WHERE v.status = 'PUBLISHED' AND v."isCurrent" = true
          AND task."workType" NOT IN ('CHECKLIST', 'ASSET')
      `),
    },
    {
      code: 'PUBLISH_APPROVAL_PRESENT',
      requiredColumns: [
        {
          table: 'OnboardingTemplateTask',
          column: 'onboardingTemplateVersionId',
        },
      ],
      sql: idSelect(`
        SELECT task.id
        FROM "OnboardingTemplateTask" task
        JOIN "OnboardingTemplateVersion" v
          ON v.id = task."onboardingTemplateVersionId"
        WHERE v.status = 'PUBLISHED' AND v."isCurrent" = true
          AND task."approvalWorkflowId" IS NOT NULL
      `),
      fallbackSql: idSelect(`
        SELECT task.id
        FROM "OnboardingTemplateTask" task
        JOIN "OnboardingTaskGroup" g ON g.id = task."taskGroupId"
        JOIN "OnboardingDepartmentTemplate" d ON d.id = g."onboardingDepartmentTemplateId"
        JOIN "OnboardingTemplateVersion" v ON v.id = d."onboardingTemplateVersionId"
        WHERE v.status = 'PUBLISHED' AND v."isCurrent" = true
          AND task."approvalWorkflowId" IS NOT NULL
      `),
    },
    {
      code: 'PUBLISH_ASSET_INVALID',
      requiredColumns: [
        { table: 'OnboardingTemplateTask', column: 'companyId' },
        {
          table: 'OnboardingTemplateTask',
          column: 'onboardingTemplateVersionId',
        },
      ],
      sql: idSelect(`
        SELECT task.id
        FROM "OnboardingTemplateTask" task
        JOIN "OnboardingTemplateVersion" v
          ON v.id = task."onboardingTemplateVersionId"
        LEFT JOIN asset_types atype
          ON atype.id = task."referenceId"
         AND atype."companyId" = task."companyId"
        WHERE v.status = 'PUBLISHED' AND v."isCurrent" = true
          AND task."workType" = 'ASSET'
          AND (
            task."ownerType" <> 'DEPARTMENT'
            OR task."referenceType" IS DISTINCT FROM 'ASSET_TYPE'
            OR atype.id IS NULL
            OR atype."isActive" = false
            OR atype."archivedAt" IS NOT NULL
            OR atype."trackingMode" IS NULL
            OR atype."trackingMode" = 'LOCATION'
          )
      `),
      fallbackSql: idSelect(`
        SELECT task.id
        FROM "OnboardingTemplateTask" task
        JOIN "OnboardingTaskGroup" g ON g.id = task."taskGroupId"
        JOIN "OnboardingDepartmentTemplate" d ON d.id = g."onboardingDepartmentTemplateId"
        JOIN "OnboardingTemplateVersion" v ON v.id = d."onboardingTemplateVersionId"
        LEFT JOIN asset_types atype
          ON atype.id = task."referenceId"
         AND atype."companyId" = v."companyId"
        WHERE v.status = 'PUBLISHED' AND v."isCurrent" = true
          AND task."workType" = 'ASSET'
          AND (
            task."ownerType" <> 'DEPARTMENT'
            OR task."referenceType" IS DISTINCT FROM 'ASSET_TYPE'
            OR atype.id IS NULL
            OR atype."isActive" = false
            OR atype."archivedAt" IS NOT NULL
            OR atype."trackingMode" IS NULL
            OR atype."trackingMode" = 'LOCATION'
          )
      `),
    },
    {
      code: 'ASSIGNMENT_BRANCH_TEMPLATE_INCOMPATIBLE',
      requiredColumns: [
        { table: 'designation_onboarding_assignments', column: 'companyId' },
        { table: 'OnboardingDepartmentTemplate', column: 'branchId' },
      ],
      sql: idSelect(`
        SELECT a.id
        FROM designation_onboarding_assignments a
        JOIN "OnboardingTemplate" t ON t.id = a."onboardingTemplateId"
        JOIN "OnboardingTemplateVersion" v
          ON v."onboardingTemplateId" = t.id
         AND v.status = 'PUBLISHED'
         AND v."isCurrent" = true
        WHERE a."isActive" = true
          AND a."branchId" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM "OnboardingDepartmentTemplate" d
            WHERE d."onboardingTemplateVersionId" = v.id
              AND d."branchId" = a."branchId"
              AND d."isActive" = true
          )
      `),
    },
    {
      code: 'ASSIGNMENT_OVERLAP_DEFAULT',
      sql: idSelect(`
        SELECT a.id
        FROM designation_onboarding_assignments a
        JOIN designation_onboarding_assignments b
          ON a."designationId" = b."designationId"
         AND a.id <> b.id
         AND a."isActive" = true
         AND b."isActive" = true
         AND a."branchId" IS NULL
         AND b."branchId" IS NULL
         AND a."effectiveFrom" <= COALESCE(b."effectiveTo", '9999-12-31')
         AND b."effectiveFrom" <= COALESCE(a."effectiveTo", '9999-12-31')
      `),
    },
    {
      code: 'ASSIGNMENT_OVERLAP_BRANCH',
      sql: idSelect(`
        SELECT a.id
        FROM designation_onboarding_assignments a
        JOIN designation_onboarding_assignments b
          ON a."designationId" = b."designationId"
         AND a.id <> b.id
         AND a."isActive" = true
         AND b."isActive" = true
         AND a."branchId" IS NOT NULL
         AND a."branchId" = b."branchId"
         AND a."effectiveFrom" <= COALESCE(b."effectiveTo", '9999-12-31')
         AND b."effectiveFrom" <= COALESCE(a."effectiveTo", '9999-12-31')
      `),
    },
    {
      code: 'ASSIGNMENT_BRANCH_COMPANY_MISMATCH',
      requiredColumns: [
        { table: 'designation_onboarding_assignments', column: 'companyId' },
      ],
      sql: idSelect(`
        SELECT a.id
        FROM designation_onboarding_assignments a
        JOIN branches br ON br.id = a."branchId"
        WHERE a."branchId" IS NOT NULL
          AND a."companyId" IS NOT NULL
          AND br."companyId" <> a."companyId"
      `),
    },
    {
      code: 'ASSIGNMENT_TEMPLATE_COMPANY_MISMATCH',
      requiredColumns: [
        { table: 'designation_onboarding_assignments', column: 'companyId' },
      ],
      sql: idSelect(`
        SELECT a.id
        FROM designation_onboarding_assignments a
        JOIN "OnboardingTemplate" t ON t.id = a."onboardingTemplateId"
        WHERE a."companyId" IS NOT NULL
          AND t."companyId" <> a."companyId"
      `),
    },
    {
      code: 'ASSIGNMENT_EFFECTIVE_DATES_INVALID',
      sql: idSelect(`
        SELECT a.id
        FROM designation_onboarding_assignments a
        WHERE a."effectiveTo" IS NOT NULL
          AND a."effectiveTo" < a."effectiveFrom"
      `),
    },
    {
      code: 'ASSIGNMENT_INACTIVE_MISSING_EVIDENCE',
      requiredColumns: [
        {
          table: 'designation_onboarding_assignments',
          column: 'deactivatedAt',
        },
        {
          table: 'designation_onboarding_assignments',
          column: 'deactivatedByUserId',
        },
      ],
      sql: idSelect(`
        SELECT a.id
        FROM designation_onboarding_assignments a
        WHERE a."isActive" = false
          AND (
            a."deactivatedAt" IS NULL
            OR a."deactivatedByUserId" IS NULL
          )
      `),
    },
  ];
