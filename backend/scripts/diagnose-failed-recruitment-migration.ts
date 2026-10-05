import { createPrismaClient } from './create-prisma-client';

async function main() {
  const { prisma, disconnect } = await createPrismaClient();
  try {
    const schema = process.env.DATABASE_SCHEMA ?? 'dsp_pms';

    const migration = await prisma.$queryRawUnsafe<
      Array<{
        migration_name: string;
        started_at: Date;
        finished_at: Date | null;
        rolled_back_at: Date | null;
        logs: string | null;
        applied_steps_count: number;
      }>
    >(
      `SELECT migration_name, started_at, finished_at, rolled_back_at, logs, applied_steps_count
       FROM "_prisma_migrations"
       WHERE migration_name = '20260814100000_recruitment_foundation'`,
    );

    const expectedTables = [
      'candidates',
      'job_openings',
      'job_opening_criteria',
      'job_applications',
      'job_application_status_history',
      'interview_sessions',
      'interview_panel_members',
      'interview_evaluations',
      'interview_evaluation_scores',
      'recruitment_documents',
      'job_offers',
      'employee_career_events',
      'designation_onboarding_assignments',
    ];
    const expectedTypes = [
      'JobOpeningStatus',
      'JobApplicationStatus',
      'InterviewSessionStatus',
      'InterviewMode',
      'EvaluationStatus',
      'JobOfferStatus',
      'RecruitmentDocumentKind',
      'MalwareScanStatus',
      'ApplicationSource',
      'EmployeeCreationSource',
      'CareerEventType',
      'CompensationPeriod',
      'RecruitmentActorType',
    ];
    const expectedIndexes = [
      'job_openings_companyId_openingCode_key',
      'candidates_companyGroupId_normalizedEmail_key',
      'job_applications_candidateId_jobOpeningId_key',
      'employees_sourceCandidateId_key',
    ];
    const expectedFks = [
      'job_openings_companyId_fkey',
      'candidates_companyGroupId_fkey',
      'job_applications_candidateId_fkey',
      'designation_onboarding_assignments_onboardingTemplateId_fkey',
      'employees_sourceCandidateId_fkey',
    ];

    const objects = await prisma.$queryRawUnsafe<
      Array<{ kind: string; name: string }>
    >(
      `SELECT 'table' AS kind, tablename AS name
       FROM pg_tables
       WHERE schemaname = $1
         AND tablename = ANY($2::text[])
       UNION ALL
       SELECT 'type', t.typname
       FROM pg_type t
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = $1
         AND t.typname = ANY($3::text[])
       UNION ALL
       SELECT 'index', i.relname
       FROM pg_class i
       JOIN pg_namespace n ON n.oid = i.relnamespace
       WHERE n.nspname = $1
         AND i.relkind = 'i'
         AND i.relname = ANY($4::text[])
       UNION ALL
       SELECT 'fk', c.conname
       FROM pg_constraint c
       JOIN pg_namespace n ON n.oid = c.connamespace
       WHERE n.nspname = $1
         AND c.contype = 'f'
         AND c.conname = ANY($5::text[])
       ORDER BY 1, 2`,
      schema,
      expectedTables,
      expectedTypes,
      expectedIndexes,
      expectedFks,
    );

    const present = new Set(objects.map((item) => `${item.kind}:${item.name}`));
    const missing = [
      ...expectedTables
        .filter((name) => !present.has(`table:${name}`))
        .map((name) => `table:${name}`),
      ...expectedTypes
        .filter((name) => !present.has(`type:${name}`))
        .map((name) => `type:${name}`),
      ...expectedIndexes
        .filter((name) => !present.has(`index:${name}`))
        .map((name) => `index:${name}`),
      ...expectedFks
        .filter((name) => !present.has(`fk:${name}`))
        .map((name) => `fk:${name}`),
    ];

    const employeeColumns = await prisma.$queryRawUnsafe<
      Array<{ column_name: string }>
    >(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = $1
         AND table_name = 'employees'
         AND column_name IN (
           'creationSource', 'sourceCandidateId', 'probationStartDate',
           'probationPlannedEndDate', 'probationConfirmedAt',
           'probationConfirmedByUserId', 'probationConfirmationNote'
         )
       ORDER BY column_name`,
      schema,
    );

    const onboardingColumns = await prisma.$queryRawUnsafe<
      Array<{ table_name: string; column_name: string }>
    >(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = $1
         AND table_name IN (
           'OnboardingTemplateVersion',
           'OnboardingDepartmentTemplate',
           'OnboardingTaskGroup',
           'OnboardingTemplateTask',
           'designation_onboarding_assignments'
         )
         AND column_name IN (
           'companyId', 'branchId', 'onboardingTemplateVersionId', 'rowVersion',
           'deactivatedAt', 'deactivatedByUserId'
         )
       ORDER BY table_name, column_name`,
      schema,
    );

    const pendingRisk = await prisma.$queryRawUnsafe<
      Array<{ kind: string; name: string }>
    >(
      `SELECT 'type' AS kind, t.typname AS name
       FROM pg_type t
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = $1
         AND t.typname IN (
           'RecruitmentDeliveryStatus', 'OnboardingCommandType',
           'OnboardingTaskActionType', 'OnboardingActionAuthorityMode',
           'OnboardingTaskResultType', 'OnboardingSourceType'
         )
       UNION ALL
       SELECT 'table', tablename
       FROM pg_tables
       WHERE schemaname = $1
         AND tablename IN (
           'recruitment_delivery_attempts',
           'public_application_idempotency',
           'OnboardingTaskActionEvent',
           'OnboardingCommandReceipt'
         )
       UNION ALL
       SELECT 'index', i.relname
       FROM pg_class i
       JOIN pg_namespace n ON n.oid = i.relnamespace
       WHERE n.nspname = $1
         AND i.relkind = 'i'
         AND i.relname IN (
           'candidates_employeeId_key',
           'job_applications_employeeId_key',
           'employee_assets_one_active_assignment_per_asset_idx',
           'OnboardingTaskActionEvent_companyId_operationId_taskId_action_key'
         )
       UNION ALL
       SELECT 'fn', p.proname
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = $1
         AND p.proname IN ('asset_v2_raise', 'asset_type_classification_guard')
       ORDER BY 1, 2`,
      schema,
    );

    const nextRisk = await prisma.$queryRawUnsafe<
      Array<{ kind: string; name: string }>
    >(
      `SELECT 'type' AS kind, t.typname AS name
       FROM pg_type t
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = $1
         AND t.typname IN (
           'RecruitmentDeliveryStatus',
           'EmployeeOnboardingStatus',
           'EmployeeOnboardingTaskStatus',
           'OnboardingContractVersion',
           'OnboardingTemplateResolutionSource'
         )
       UNION ALL
       SELECT 'table', tablename
       FROM pg_tables
       WHERE schemaname = $1
         AND tablename IN (
           'recruitment_delivery_attempts',
           'onboarding_task_actions',
           'onboarding_command_receipts'
         )
       UNION ALL
       SELECT 'column', table_name || '.' || column_name
       FROM information_schema.columns
       WHERE table_schema = $1
         AND (
           (table_name = 'job_offers' AND column_name = 'responseTokenCiphertext')
           OR (table_name = 'OnboardingTemplate' AND column_name = 'version')
           OR (table_name = 'EmployeeOnboarding' AND column_name = 'contractVersion')
         )
       ORDER BY 1, 2`,
      schema,
    );

    const functionsAnywhere = await prisma.$queryRawUnsafe<
      Array<{ schema: string; name: string }>
    >(
      `SELECT n.nspname AS schema, p.proname AS name
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE p.proname IN (
         'asset_v2_raise',
         'asset_type_classification_guard',
         'asset_cross_branch_transfer_guard',
         'employee_organization_custody_guard'
       )
       ORDER BY 1, 2`,
    );

    const workOwnerValues = await prisma.$queryRawUnsafe<
      Array<{ enumlabel: string }>
    >(
      `SELECT e.enumlabel
       FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = $1 AND t.typname = 'WorkOwnerType'
       ORDER BY e.enumsortorder`,
      schema,
    );

    const laterMigrations = await prisma.$queryRawUnsafe<
      Array<{
        migration_name: string;
        finished_at: Date | null;
        rolled_back_at: Date | null;
        logs: string | null;
      }>
    >(
      `SELECT migration_name, finished_at, rolled_back_at, logs
       FROM "_prisma_migrations"
       WHERE migration_name >= '20260814100000_recruitment_foundation'
       ORDER BY migration_name`,
    );

    console.log(
      JSON.stringify(
        {
          failedMigration: migration,
          missing,
          employeeColumns,
          recruitmentObjects: objects,
          onboardingColumns,
          nextRisk,
          pendingRisk,
          functionsAnywhere,
          workOwnerValues,
          migrationsFromFailedOnward: laterMigrations.map((item) => ({
            name: item.migration_name,
            finished: item.finished_at,
            rolledBack: item.rolled_back_at,
            logPreview: item.logs?.slice(0, 500) ?? null,
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
