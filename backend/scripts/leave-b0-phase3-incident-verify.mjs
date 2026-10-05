/**
 * Emergency read-only verify after accidental B0 apply to dsp_pms.
 * SELECT only. No secrets printed.
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const schema = (process.env.DATABASE_SCHEMA || "dsp_pms").trim();
const databaseUrl = process.env.DATABASE_URL?.replace(
  /^postgres(?:ql)?\+asyncpg:\/\//i,
  "postgresql://",
);

const pool = new Pool({
  connectionString: databaseUrl,
  ssl:
    process.env.DATABASE_SSL_MODE === "require"
      ? { rejectUnauthorized: false }
      : undefined,
});

const client = await pool.connect();
try {
  await client.query(`SET search_path TO ${schema}`);
  const identity = (
    await client.query(
      `SELECT current_database() AS database_name, current_schema() AS current_schema`,
    )
  ).rows[0];

  const migration = (
    await client.query(
      `SELECT "migration_name", "started_at", "finished_at", "rolled_back_at"
       FROM "_prisma_migrations"
       WHERE "migration_name" = '20260811120000_leave_policy_matrix_and_manager_hr_approval'`,
    )
  ).rows;

  const indexes = (
    await client.query(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = $1
         AND indexname IN (
           'leave_policies_active_branch_default_uidx',
           'leave_policies_active_branch_dept_uidx',
           'leave_policies_active_branch_designation_uidx',
           'leave_policies_active_branch_dept_designation_uidx',
           'approval_transaction_steps_approverId_status_stepNo_idx',
           'leave_requests_status_submittedAt_idx'
         )
       ORDER BY indexname`,
      [schema],
    )
  ).rows;

  const workflows = (
    await client.query(
      `SELECT aw."scopeKey", aw."isActive",
              COUNT(s."id")::int AS step_count,
              STRING_AGG(
                s."stepNo" || ':' || s."approverType" || COALESCE(':' || s."approverRole", ''),
                ', ' ORDER BY s."stepNo"
              ) AS steps
       FROM "approval_workflows" aw
       LEFT JOIN "approval_workflow_steps" s ON s."workflowId" = aw."id"
       WHERE aw."workflowCode" = 'LEAVE_APPROVAL'
          OR aw."scopeKey" LIKE '%:LEAVE_APPROVAL'
       GROUP BY aw."id"
       ORDER BY aw."scopeKey"`,
    )
  ).rows;

  const counts = (
    await client.query(
      `SELECT 'leave_policies' AS entity, COUNT(*)::int AS row_count FROM "leave_policies"
       UNION ALL SELECT 'leave_requests', COUNT(*)::int FROM "leave_requests"
       UNION ALL SELECT 'employee_leave_balances', COUNT(*)::int FROM "employee_leave_balances"
       UNION ALL SELECT 'approval_transactions', COUNT(*)::int FROM "approval_transactions"
       UNION ALL SELECT 'approval_workflow_steps', COUNT(*)::int FROM "approval_workflow_steps"`,
    )
  ).rows;

  const evidence = {
    recordedAt: new Date().toISOString(),
    reason:
      "Post-incident verify: Phase 3a wrapper passed DATABASE_URL with disposable schema, but prisma.config.ts forced DATABASE_SCHEMA=dsp_pms and migrate deploy applied B0 to shared schema.",
    identity,
    migration,
    indexes,
    indexCount: indexes.length,
    workflows,
    counts,
    expectedVsBaseline: {
      leave_policies_unchanged: counts.find((c) => c.entity === "leave_policies")?.row_count === 6,
      leave_requests_unchanged: counts.find((c) => c.entity === "leave_requests")?.row_count === 10,
      balances_unchanged: counts.find((c) => c.entity === "employee_leave_balances")?.row_count === 10,
      approval_transactions_unchanged:
        counts.find((c) => c.entity === "approval_transactions")?.row_count === 5,
      workflow_steps_plus_one:
        counts.find((c) => c.entity === "approval_workflow_steps")?.row_count === 4,
    },
  };
  evidence.pass =
    migration.length === 1 &&
    migration[0].finished_at != null &&
    migration[0].rolled_back_at == null &&
    indexes.length === 6 &&
    workflows.some(
      (w) =>
        w.scopeKey === "GLOBAL:LEAVE_APPROVAL" &&
        Number(w.step_count) >= 2 &&
        String(w.steps).includes("HR_MANAGER"),
    ) &&
    Object.values(evidence.expectedVsBaseline).every(Boolean);

  const out = resolve(
    repoRoot,
    "docs/product/leave-policy-matrix-migration-phase3-incident-verify.json",
  );
  writeFileSync(out, JSON.stringify(evidence, null, 2), "utf8");
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`Wrote ${out}`);
  console.log(`VERIFY_PASS=${evidence.pass}`);
  process.exit(evidence.pass ? 0 : 2);
} finally {
  client.release();
  await pool.end();
}
