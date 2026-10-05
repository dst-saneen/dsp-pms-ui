export const PROJECT_LITE_PREFLIGHT_ID_LIMIT = 200;

export type ProjectLiteFindingCode =
  | 'DUPLICATE_COMPANY_PROJECT_CODE'
  | 'UNKNOWN_PROJECT_STATUS'
  | 'UNKNOWN_STAGE_STATUS'
  | 'UNKNOWN_TASK_STATUS'
  | 'UNKNOWN_PARTICIPANT_STATUS'
  | 'UNKNOWN_WORK_LOG_STATUS'
  | 'CROSS_COMPANY_BRANCH'
  | 'CROSS_COMPANY_MANAGER'
  | 'CROSS_COMPANY_TEAM_MEMBER'
  | 'CROSS_COMPANY_TASK_PARENT'
  | 'MISSING_OR_INACTIVE_MANAGER'
  | 'DUPLICATE_STAGE_CODE'
  | 'DUPLICATE_STAGE_SEQUENCE'
  | 'DUPLICATE_TASK_CODE'
  | 'PARENT_SELF_LINK'
  | 'PARENT_CYCLE_OR_CROSS_PROJECT'
  | 'INVALID_ALLOCATION_PERCENTAGE'
  | 'INVALID_TASK_PROGRESS'
  | 'INVALID_WORK_LOG_PERIOD'
  | 'INVALID_WORK_LOG_LINE_SHAPE'
  | 'DAILY_HOURS_EXCEEDED'
  | 'WORK_LOG_GENERIC_APPROVAL_LINK'
  | 'TASK_SUBMISSION_LOCAL_FILE_PATH'
  | 'CLIENT_STRINGS_UNMAPPED';

export interface ProjectLiteSqlCheck {
  code: ProjectLiteFindingCode;
  /** True when Phase 3 contract migration must not run until zero. */
  blocking: boolean;
  sql: string;
}

function idSelect(sql: string): string {
  return `${sql.trim().replace(/;+\s*$/, '')} LIMIT ${PROJECT_LITE_PREFLIGHT_ID_LIMIT}`;
}

/** Read-only exception queries (plan §9). Each statement returns `id`. */
export const PROJECT_LITE_PREFLIGHT_CHECKS: readonly ProjectLiteSqlCheck[] = [
  {
    code: 'DUPLICATE_COMPANY_PROJECT_CODE',
    blocking: true,
    sql: idSelect(`
      SELECT p.id
      FROM projects p
      WHERE EXISTS (
        SELECT 1
        FROM projects d
        WHERE d."companyId" = p."companyId"
          AND d."projectCode" = p."projectCode"
          AND d.id <> p.id
      )
      ORDER BY p.id
    `),
  },
  {
    code: 'UNKNOWN_PROJECT_STATUS',
    blocking: true,
    sql: idSelect(`
      SELECT p.id
      FROM projects p
      WHERE upper(trim(p.status)) NOT IN (
        'DRAFT', 'PROPOSAL', 'APPROVED', 'ACTIVE',
        'ON_HOLD', 'ONHOLD', 'COMPLETED', 'CLOSED', 'CANCELLED'
      )
      ORDER BY p.id
    `),
  },
  {
    code: 'UNKNOWN_STAGE_STATUS',
    blocking: true,
    sql: idSelect(`
      SELECT s.id
      FROM project_stages s
      WHERE upper(trim(s.status)) NOT IN (
        'OPEN', 'PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'
      )
      ORDER BY s.id
    `),
  },
  {
    code: 'UNKNOWN_TASK_STATUS',
    blocking: true,
    sql: idSelect(`
      SELECT t.id
      FROM project_tasks t
      WHERE upper(trim(t.status)) NOT IN (
        'NOT_STARTED', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'INPROGRESS',
        'WAITING_REVIEW', 'IN_REVIEW', 'REVIEW', 'COMPLETED', 'CANCELLED'
      )
      ORDER BY t.id
    `),
  },
  {
    code: 'UNKNOWN_PARTICIPANT_STATUS',
    blocking: true,
    sql: idSelect(`
      SELECT tp.id
      FROM task_participants tp
      WHERE upper(trim(tp.status)) NOT IN (
        'PENDING', 'ACTIVE', 'ENDED', 'REMOVED', 'INACTIVE'
      )
      ORDER BY tp.id
    `),
  },
  {
    code: 'UNKNOWN_WORK_LOG_STATUS',
    blocking: true,
    sql: idSelect(`
      SELECT h.id
      FROM work_log_headers h
      WHERE upper(trim(h.status)) NOT IN (
        'DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED', 'CANCELLED', 'REJECTED'
      )
      ORDER BY h.id
    `),
  },
  {
    code: 'CROSS_COMPANY_BRANCH',
    blocking: true,
    sql: idSelect(`
      SELECT p.id
      FROM projects p
      JOIN branches b ON b.id = p."branchId"
      WHERE p."branchId" IS NOT NULL
        AND b."companyId" <> p."companyId"
      ORDER BY p.id
    `),
  },
  {
    code: 'CROSS_COMPANY_MANAGER',
    blocking: true,
    sql: idSelect(`
      SELECT p.id
      FROM projects p
      JOIN employees e ON e.id = p."projectmanagerId"
      WHERE p."projectmanagerId" IS NOT NULL
        AND e."companyId" <> p."companyId"
      ORDER BY p.id
    `),
  },
  {
    code: 'CROSS_COMPANY_TEAM_MEMBER',
    blocking: true,
    sql: idSelect(`
      SELECT m.id
      FROM project_team_members m
      JOIN projects p ON p.id = m."projectId"
      JOIN employees e ON e.id = m."employeeId"
      WHERE e."companyId" <> p."companyId"
      ORDER BY m.id
    `),
  },
  {
    code: 'CROSS_COMPANY_TASK_PARENT',
    blocking: true,
    sql: idSelect(`
      SELECT t.id
      FROM project_tasks t
      JOIN project_tasks parent ON parent.id = t."parentTaskId"
      WHERE t."parentTaskId" IS NOT NULL
        AND (
          parent."projectId" <> t."projectId"
          OR COALESCE(parent."companyId", '') <> COALESCE(t."companyId", '')
        )
      ORDER BY t.id
    `),
  },
  {
    code: 'MISSING_OR_INACTIVE_MANAGER',
    blocking: true,
    sql: idSelect(`
      SELECT p.id
      FROM projects p
      LEFT JOIN employees e ON e.id = p."projectmanagerId"
      WHERE p."projectmanagerId" IS NOT NULL
        AND (
          e.id IS NULL
          OR e."isActive" = false
          OR upper(trim(e."employmentStatus")) NOT IN ('ACTIVE')
        )
      ORDER BY p.id
    `),
  },
  {
    code: 'DUPLICATE_STAGE_CODE',
    blocking: true,
    sql: idSelect(`
      SELECT s.id
      FROM project_stages s
      WHERE EXISTS (
        SELECT 1
        FROM project_stages d
        WHERE d."projectId" = s."projectId"
          AND d."stageCode" = s."stageCode"
          AND d.id <> s.id
      )
      ORDER BY s.id
    `),
  },
  {
    code: 'DUPLICATE_STAGE_SEQUENCE',
    blocking: true,
    sql: idSelect(`
      SELECT s.id
      FROM project_stages s
      WHERE EXISTS (
        SELECT 1
        FROM project_stages d
        WHERE d."projectId" = s."projectId"
          AND d."sequenceNo" = s."sequenceNo"
          AND d.id <> s.id
      )
      ORDER BY s.id
    `),
  },
  {
    code: 'DUPLICATE_TASK_CODE',
    blocking: true,
    sql: idSelect(`
      SELECT t.id
      FROM project_tasks t
      WHERE EXISTS (
        SELECT 1
        FROM project_tasks d
        WHERE d."projectId" = t."projectId"
          AND d."taskCode" = t."taskCode"
          AND d.id <> t.id
      )
      ORDER BY t.id
    `),
  },
  {
    code: 'PARENT_SELF_LINK',
    blocking: true,
    sql: idSelect(`
      SELECT t.id
      FROM project_tasks t
      WHERE t."parentTaskId" IS NOT NULL
        AND t."parentTaskId" = t.id
      ORDER BY t.id
    `),
  },
  {
    code: 'PARENT_CYCLE_OR_CROSS_PROJECT',
    blocking: true,
    sql: idSelect(`
      WITH RECURSIVE walk AS (
        SELECT t.id, t."parentTaskId", t."projectId", 1 AS depth, ARRAY[t.id] AS path
        FROM project_tasks t
        WHERE t."parentTaskId" IS NOT NULL
        UNION ALL
        SELECT c.id, c."parentTaskId", c."projectId", w.depth + 1, w.path || c.id
        FROM project_tasks c
        JOIN walk w ON c.id = w."parentTaskId"
        WHERE w.depth < 50
          AND NOT (c.id = ANY (w.path))
      )
      SELECT DISTINCT w.id
      FROM walk w
      JOIN project_tasks parent ON parent.id = w."parentTaskId"
      WHERE w."parentTaskId" = ANY (w.path)
         OR parent."projectId" <> w."projectId"
      ORDER BY w.id
    `),
  },
  {
    code: 'INVALID_ALLOCATION_PERCENTAGE',
    blocking: true,
    sql: idSelect(`
      SELECT m.id
      FROM project_team_members m
      WHERE m."allocationPercentage" IS NULL
         OR m."allocationPercentage" <= 0
         OR m."allocationPercentage" > 100
      ORDER BY m.id
    `),
  },
  {
    code: 'INVALID_TASK_PROGRESS',
    blocking: true,
    sql: idSelect(`
      SELECT t.id
      FROM project_tasks t
      WHERE t."completionPercentage" IS NOT NULL
        AND (
          t."completionPercentage" < 0
          OR t."completionPercentage" > 100
        )
      ORDER BY t.id
    `),
  },
  {
    code: 'INVALID_WORK_LOG_PERIOD',
    blocking: true,
    sql: idSelect(`
      SELECT h.id
      FROM work_log_headers h
      WHERE h."endDate" < h."startDate"
         OR (
           h."periodStart" IS NOT NULL
           AND h."periodEnd" IS NOT NULL
           AND h."periodEnd" < h."periodStart"
         )
      ORDER BY h.id
    `),
  },
  {
    code: 'INVALID_WORK_LOG_LINE_SHAPE',
    blocking: true,
    sql: idSelect(`
      SELECT l.id
      FROM work_log_lines l
      WHERE (
          (l."taskId" IS NULL AND l."workCategoryId" IS NULL)
          OR (l."taskId" IS NOT NULL AND l."workCategoryId" IS NOT NULL)
        )
         OR l.hours IS NULL
         OR l.hours <= 0
         OR l.hours > 24
      ORDER BY l.id
    `),
  },
  {
    code: 'DAILY_HOURS_EXCEEDED',
    blocking: true,
    sql: idSelect(`
      SELECT l.id
      FROM work_log_lines l
      JOIN (
        SELECT
          COALESCE(l2."employeeId", h."employeeId") AS employee_id,
          l2."workDate"::date AS work_day,
          SUM(l2.hours) AS total_hours
        FROM work_log_lines l2
        JOIN work_log_headers h ON h.id = l2."workLogHeaderId"
        GROUP BY COALESCE(l2."employeeId", h."employeeId"), l2."workDate"::date
        HAVING SUM(l2.hours) > 24
      ) overages
        ON overages.employee_id = COALESCE(l."employeeId", (
          SELECT h2."employeeId" FROM work_log_headers h2 WHERE h2.id = l."workLogHeaderId"
        ))
       AND overages.work_day = l."workDate"::date
      ORDER BY l.id
    `),
  },
  {
    code: 'WORK_LOG_GENERIC_APPROVAL_LINK',
    blocking: false,
    sql: idSelect(`
      SELECT h.id
      FROM work_log_headers h
      WHERE h."approvalTransactionId" IS NOT NULL
      ORDER BY h.id
    `),
  },
  {
    code: 'TASK_SUBMISSION_LOCAL_FILE_PATH',
    blocking: true,
    sql: idSelect(`
      SELECT s.id
      FROM task_submissions s
      WHERE nullif(trim(s."filePath"), '') IS NOT NULL
      ORDER BY s.id
    `),
  },
  {
    code: 'CLIENT_STRINGS_UNMAPPED',
    blocking: true,
    sql: idSelect(`
      SELECT p.id
      FROM projects p
      WHERE p."businessPartyId" IS NULL
        AND (
          nullif(trim(p."clientName"), '') IS NOT NULL
          OR nullif(trim(p."clientContact"), '') IS NOT NULL
          OR p."contractValue" IS NOT NULL
        )
      ORDER BY p.id
    `),
  },
];
