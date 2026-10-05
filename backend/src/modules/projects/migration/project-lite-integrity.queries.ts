export type ProjectLiteIntegrityCode =
  | 'NULL_TYPED_PROJECT_FIELDS'
  | 'NULL_CHILD_COMPANY_OR_STATUS'
  | 'GLOBAL_PROJECT_CODE_UNIQUE_STILL_PRESENT'
  | 'MISSING_COMPANY_PROJECT_CODE_UNIQUE'
  | 'MISSING_ACTIVE_TEAM_PARTIAL_UNIQUE'
  | 'MISSING_ACTIVE_PARTICIPANT_PARTIAL_UNIQUE'
  | 'MISSING_PARENT_CYCLE_TRIGGER'
  | 'MISSING_DAILY_HOURS_TRIGGER'
  | 'MISSING_HISTORY_IMMUTABLE_TRIGGER'
  | 'INTERNAL_WITH_BUSINESS_PARTY';

export interface ProjectLiteIntegrityCheck {
  code: ProjectLiteIntegrityCode;
  sql: string;
}

/** Post-contract verifier: every query must return zero rows (id column). */
export const PROJECT_LITE_INTEGRITY_CHECKS: readonly ProjectLiteIntegrityCheck[] =
  [
    {
      code: 'NULL_TYPED_PROJECT_FIELDS',
      sql: `
        SELECT p.id
        FROM projects p
        WHERE p."statusV2" IS NULL OR p."projectType" IS NULL
        LIMIT 50
      `,
    },
    {
      code: 'NULL_CHILD_COMPANY_OR_STATUS',
      sql: `
        SELECT s.id
        FROM project_stages s
        WHERE s."companyId" IS NULL OR s."statusV2" IS NULL
        UNION ALL
        SELECT t.id
        FROM project_tasks t
        WHERE t."companyId" IS NULL OR t."statusV2" IS NULL
        UNION ALL
        SELECT m.id
        FROM project_team_members m
        WHERE m."companyId" IS NULL OR m."statusV2" IS NULL
        LIMIT 50
      `,
    },
    {
      code: 'GLOBAL_PROJECT_CODE_UNIQUE_STILL_PRESENT',
      sql: `
        SELECT c.oid::text AS id
        FROM pg_catalog.pg_constraint c
        JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'projects'
          AND c.conname = 'projects_projectCode_key'
        LIMIT 1
      `,
    },
    {
      code: 'MISSING_COMPANY_PROJECT_CODE_UNIQUE',
      sql: `
        SELECT 'missing'::text AS id
        WHERE NOT EXISTS (
          SELECT 1
          FROM pg_catalog.pg_indexes
          WHERE tablename = 'projects'
            AND indexname = 'projects_companyId_projectCode_key'
        )
      `,
    },
    {
      code: 'MISSING_ACTIVE_TEAM_PARTIAL_UNIQUE',
      sql: `
        SELECT 'missing'::text AS id
        WHERE NOT EXISTS (
          SELECT 1
          FROM pg_catalog.pg_indexes
          WHERE tablename = 'project_team_members'
            AND indexname = 'project_team_members_one_active_membership_idx'
        )
      `,
    },
    {
      code: 'MISSING_ACTIVE_PARTICIPANT_PARTIAL_UNIQUE',
      sql: `
        SELECT 'missing'::text AS id
        WHERE NOT EXISTS (
          SELECT 1
          FROM pg_catalog.pg_indexes
          WHERE tablename = 'task_participants'
            AND indexname = 'task_participants_one_active_assignment_idx'
        )
      `,
    },
    {
      code: 'MISSING_PARENT_CYCLE_TRIGGER',
      sql: `
        SELECT 'missing'::text AS id
        WHERE NOT EXISTS (
          SELECT 1
          FROM pg_catalog.pg_trigger
          WHERE tgname = 'trg_project_task_parent_cycle_guard'
            AND NOT tgisinternal
        )
      `,
    },
    {
      code: 'MISSING_DAILY_HOURS_TRIGGER',
      sql: `
        SELECT 'missing'::text AS id
        WHERE NOT EXISTS (
          SELECT 1
          FROM pg_catalog.pg_trigger
          WHERE tgname = 'trg_work_log_daily_hours_guard'
            AND NOT tgisinternal
        )
      `,
    },
    {
      code: 'MISSING_HISTORY_IMMUTABLE_TRIGGER',
      sql: `
        SELECT 'missing'::text AS id
        WHERE NOT EXISTS (
          SELECT 1
          FROM pg_catalog.pg_trigger
          WHERE tgname = 'trg_project_action_events_immutable'
            AND NOT tgisinternal
        )
      `,
    },
    {
      code: 'INTERNAL_WITH_BUSINESS_PARTY',
      sql: `
        SELECT p.id
        FROM projects p
        WHERE p."projectType" = 'INTERNAL'
          AND p."businessPartyId" IS NOT NULL
        LIMIT 50
      `,
    },
  ];
