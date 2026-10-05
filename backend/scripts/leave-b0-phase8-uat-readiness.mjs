/**
 * Phase 8 — read-only UAT persona / pilot readiness check.
 * Does not create leave or mutate balances.
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.replace(
    /^postgres(?:ql)?\+asyncpg:\/\//i,
    "postgresql://",
  ),
  ssl:
    process.env.DATABASE_SSL_MODE === "require"
      ? { rejectUnauthorized: false }
      : undefined,
});

const client = await pool.connect();
try {
  await client.query("SET search_path TO dsp_pms");

  const identity = (
    await client.query(
      `SELECT current_database() AS database_name, current_schema() AS current_schema`,
    )
  ).rows[0];

  const migration = (
    await client.query(
      `SELECT "migration_name", "finished_at"
       FROM "_prisma_migrations"
       WHERE "migration_name" = '20260811120000_leave_policy_matrix_and_manager_hr_approval'`,
    )
  ).rows[0];

  const workflow = (
    await client.query(
      `SELECT aw."scopeKey",
              STRING_AGG(
                s."stepNo" || ':' || s."approverType" || COALESCE(':' || s."approverRole", ''),
                ', ' ORDER BY s."stepNo"
              ) AS steps
       FROM "approval_workflows" aw
       LEFT JOIN "approval_workflow_steps" s ON s."workflowId" = aw."id"
       WHERE aw."scopeKey" = 'GLOBAL:LEAVE_APPROVAL'
       GROUP BY aw."id"`,
    )
  ).rows[0];

  const uatUsers = (
    await client.query(
      `SELECT u.username, u.email, u.status::text AS status, u."employeeId" IS NOT NULL AS has_employee,
              e."employeeCode", e."firstName", e."lastName",
              c."companyCode", b."branchCode", b."branchName" AS branch_name,
              e."managerId" IS NOT NULL AS has_manager
       FROM users u
       LEFT JOIN employees e ON e.id = u."employeeId"
       LEFT JOIN companies c ON c.id = e."companyId"
       LEFT JOIN branches b ON b.id = e."branchId"
       WHERE u.username ILIKE '%leave.uat%'
          OR COALESCE(u.email, '') ILIKE '%leave.uat%'
          OR u."normalizedUsername" ILIKE '%leave.uat%'
       ORDER BY u.username`,
    )
  ).rows;

  const pilotCompany = (
    await client.query(
      `SELECT id, "companyCode", "companyName" AS name
       FROM companies
       WHERE "companyCode" = 'COM-000002'
       LIMIT 1`,
    )
  ).rows[0];

  const pilotBranches = pilotCompany
    ? (
        await client.query(
          `SELECT id, "branchCode", "branchName" AS name
           FROM branches
           WHERE "companyId" = $1 AND "isActive" = true
           ORDER BY "branchCode"`,
          [pilotCompany.id],
        )
      ).rows
    : [];

  const hrOnPilot = pilotCompany
    ? (
        await client.query(
          `SELECT r.code AS role_code, COUNT(DISTINCT u.id)::int AS users
           FROM "user_role_assignments" ura
           JOIN roles r ON r.id = ura."roleId"
           JOIN users u ON u.id = ura."userId"
           WHERE ura."isActive" = true
             AND r."isActive" = true
             AND u.status = 'ACTIVE'
             AND r.code IN ('HR_MANAGER', 'COMPANY_ADMINISTRATOR', 'ORGANIZATION_OWNER')
             AND (
               ura."companyId" = $1
               OR ura."branchId" IN (SELECT id FROM branches WHERE "companyId" = $1)
               OR ura."companyGroupId" IN (
                 SELECT "companyGroupId" FROM companies WHERE id = $1
               )
             )
           GROUP BY r.code
           ORDER BY r.code`,
          [pilotCompany.id],
        )
      ).rows
    : [];

  const evidence = {
    recordedAt: new Date().toISOString(),
    phase: "8-uat-readiness",
    notes:
      "Read-only readiness for human UAT. Does not sign Employee/Manager/HR results.",
    identity,
    b0Applied: Boolean(migration?.finished_at),
    migration,
    globalLeaveWorkflow: workflow,
    suggestedUatAccounts: uatUsers,
    uatAccountsFound: uatUsers.length,
    pilotCompany,
    pilotBranches,
    hrOnPilot,
    readyForHumanUat:
      Boolean(migration?.finished_at) &&
      String(workflow?.steps || "").includes("HR_MANAGER") &&
      Boolean(pilotCompany) &&
      hrOnPilot.length > 0,
  };

  const out = resolve(
    repoRoot,
    "docs/product/leave-policy-matrix-migration-phase8-readiness.json",
  );
  writeFileSync(out, JSON.stringify(evidence, null, 2), "utf8");
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`Wrote ${out}`);
  console.log(`READY_FOR_HUMAN_UAT=${evidence.readyForHumanUat}`);
} finally {
  client.release();
  await pool.end();
}
