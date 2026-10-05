/**
 * Phase 2 — read-only assessment for B0 migration (SELECT only).
 * Uses backend .env DATABASE_URL / DATABASE_SCHEMA. Never writes.
 *
 * Usage: node scripts/leave-b0-phase2-readonly-assess.mjs
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, "..");
const repoRoot = resolve(backendRoot, "..");

const databaseUrl = process.env.DATABASE_URL;
const schema = (process.env.DATABASE_SCHEMA ?? "").trim();

if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (!schema || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
  console.error("DATABASE_SCHEMA must be a valid identifier");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl.replace(
    /^postgres(?:ql)?\+asyncpg:\/\//i,
    "postgresql://",
  ),
  ssl:
    process.env.DATABASE_SSL_MODE === "require"
      ? { rejectUnauthorized: false }
      : undefined,
});

async function q(client, label, sql, params = []) {
  const result = await client.query(sql, params);
  return { label, rowCount: result.rowCount, rows: result.rows };
}

async function main() {
  const client = await pool.connect();
  const evidence = {
    recordedAt: new Date().toISOString(),
    operator: process.env.USERNAME || process.env.USER || "unknown",
    notes: "Read-only Phase 2 assessment. No DDL/DML applied.",
  };

  try {
    await client.query(`SET search_path TO ${schema}`);

    evidence.identity = (
      await q(
        client,
        "identity",
        `SELECT current_database() AS database_name,
                current_schema() AS current_schema,
                current_user AS connected_user,
                current_setting('search_path') AS search_path`,
      )
    ).rows[0];

    const duplicateQueries = [
      [
        "branch_default",
        `SELECT "companyId", "branchId", "leaveTypeId", COUNT(*)::int AS duplicate_count
         FROM "leave_policies"
         WHERE "isActive" = true AND "departmentId" IS NULL AND "designationId" IS NULL
         GROUP BY 1, 2, 3 HAVING COUNT(*) > 1`,
      ],
      [
        "branch_department",
        `SELECT "companyId", "branchId", "departmentId", "leaveTypeId", COUNT(*)::int AS duplicate_count
         FROM "leave_policies"
         WHERE "isActive" = true AND "departmentId" IS NOT NULL AND "designationId" IS NULL
         GROUP BY 1, 2, 3, 4 HAVING COUNT(*) > 1`,
      ],
      [
        "branch_designation",
        `SELECT "companyId", "branchId", "designationId", "leaveTypeId", COUNT(*)::int AS duplicate_count
         FROM "leave_policies"
         WHERE "isActive" = true AND "departmentId" IS NULL AND "designationId" IS NOT NULL
         GROUP BY 1, 2, 3, 4 HAVING COUNT(*) > 1`,
      ],
      [
        "branch_department_designation",
        `SELECT "companyId", "branchId", "departmentId", "designationId", "leaveTypeId", COUNT(*)::int AS duplicate_count
         FROM "leave_policies"
         WHERE "isActive" = true AND "departmentId" IS NOT NULL AND "designationId" IS NOT NULL
         GROUP BY 1, 2, 3, 4, 5 HAVING COUNT(*) > 1`,
      ],
    ];

    evidence.duplicates = {};
    let duplicateTotal = 0;
    for (const [name, sql] of duplicateQueries) {
      const result = await q(client, name, sql);
      evidence.duplicates[name] = {
        rowCount: result.rowCount,
        rows: result.rows,
      };
      duplicateTotal += result.rowCount;
    }
    evidence.duplicatesAllZero = duplicateTotal === 0;

    const workflows = await q(
      client,
      "workflows",
      `SELECT aw."id",
              aw."scopeKey",
              aw."companyId",
              aw."isActive",
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
    );
    evidence.workflows = workflows.rows;

    const classified = [];
    let expectedHrStepsToAdd = 0;
    for (const row of workflows.rows) {
      const steps = row.steps ?? "";
      const isGlobal =
        row.scopeKey === "GLOBAL:LEAVE_APPROVAL" ||
        row.scopeKey?.startsWith("GLOBAL:");
      const isCompany = String(row.scopeKey ?? "").startsWith("COMPANY:");
      const uncustomized =
        row.isActive === true &&
        Number(row.step_count) === 1 &&
        steps === "1:REPORTING_MANAGER";
      const hasHrStep =
        /:ROLE:HR_MANAGER|:HR\b|:ROLE:HR\b/i.test(steps) ||
        /2:ROLE:HR_MANAGER/i.test(steps);
      let kind = "OTHER";
      if (isGlobal) kind = "GLOBAL";
      else if (isCompany && uncustomized) kind = "COMPANY_UNCUSTOMIZED";
      else if (isCompany) kind = "COMPANY_CUSTOMIZED";

      let willAddHr = false;
      if (row.isActive && !hasHrStep) {
        if (kind === "GLOBAL" || kind === "COMPANY_UNCUSTOMIZED") {
          willAddHr = true;
          expectedHrStepsToAdd += 1;
        }
      }
      classified.push({
        id: row.id,
        scopeKey: row.scopeKey,
        companyId: row.companyId,
        isActive: row.isActive,
        step_count: row.step_count,
        steps,
        kind,
        hasHrStep,
        willAddHrStep: willAddHr,
      });
    }
    evidence.workflowClassification = classified;
    evidence.expectedHrStepsToAdd = expectedHrStepsToAdd;

    evidence.baselineCounts = (
      await q(
        client,
        "counts",
        `SELECT 'leave_policies' AS entity, COUNT(*)::int AS row_count FROM "leave_policies"
         UNION ALL
         SELECT 'leave_requests', COUNT(*)::int FROM "leave_requests"
         UNION ALL
         SELECT 'employee_leave_balances', COUNT(*)::int FROM "employee_leave_balances"
         UNION ALL
         SELECT 'approval_transactions', COUNT(*)::int FROM "approval_transactions"
         UNION ALL
         SELECT 'approval_workflow_steps', COUNT(*)::int FROM "approval_workflow_steps"`,
      )
    ).rows;

    evidence.leaveRequestStatusCounts = (
      await q(
        client,
        "leave_status",
        `SELECT "status", COUNT(*)::int AS row_count
         FROM "leave_requests"
         GROUP BY 1
         ORDER BY 1`,
      )
    ).rows;

    evidence.existingLeaveWorkflowSteps = (
      await q(
        client,
        "steps",
        `SELECT s."id", s."workflowId", s."stepNo", s."approverType", s."approverRole", aw."scopeKey"
         FROM "approval_workflow_steps" s
         JOIN "approval_workflows" aw ON aw."id" = s."workflowId"
         WHERE aw."workflowCode" = 'LEAVE_APPROVAL'
            OR aw."scopeKey" LIKE '%:LEAVE_APPROVAL'
         ORDER BY aw."scopeKey", s."stepNo"`,
      )
    ).rows;

    evidence.eligibleHrAssignments = (
      await q(
        client,
        "hr",
        `SELECT r.code AS role_code,
                ura."companyId",
                ura."branchId",
                ura.scope,
                COUNT(DISTINCT u.id)::int AS active_user_count
         FROM "user_role_assignments" ura
         JOIN "roles" r ON r.id = ura."roleId"
         JOIN "users" u ON u.id = ura."userId"
         WHERE ura."isActive" = true
           AND r."isActive" = true
           AND u.status = 'ACTIVE'
           AND r.code IN ('HR_MANAGER', 'COMPANY_ADMINISTRATOR', 'ORGANIZATION_OWNER')
         GROUP BY 1, 2, 3, 4
         ORDER BY 1, 2, 3`,
      )
    ).rows;

    evidence.eligibleHrUserTotal = (
      await q(
        client,
        "hr_total",
        `SELECT COUNT(DISTINCT u.id)::int AS active_hr_users
         FROM "user_role_assignments" ura
         JOIN "roles" r ON r.id = ura."roleId"
         JOIN "users" u ON u.id = ura."userId"
         WHERE ura."isActive" = true
           AND r."isActive" = true
           AND u.status = 'ACTIVE'
           AND r.code IN ('HR_MANAGER', 'COMPANY_ADMINISTRATOR', 'ORGANIZATION_OWNER')`,
      )
    ).rows[0];

    const companiesNeedingHr = classified
      .filter((w) => w.willAddHrStep && w.companyId)
      .map((w) => w.companyId);
    const uniqueCompanies = [...new Set(companiesNeedingHr)];
    const companiesMissingHr = [];
    for (const companyId of uniqueCompanies) {
      const found = await q(
        client,
        "hr_for_company",
        `SELECT COUNT(DISTINCT u.id)::int AS cnt
         FROM "user_role_assignments" ura
         JOIN "roles" r ON r.id = ura."roleId"
         JOIN "users" u ON u.id = ura."userId"
         WHERE ura."isActive" = true
           AND r."isActive" = true
           AND u.status = 'ACTIVE'
           AND r.code IN ('HR_MANAGER', 'COMPANY_ADMINISTRATOR', 'ORGANIZATION_OWNER')
           AND (
             ura."companyId" = $1
             OR ura."branchId" IN (SELECT id FROM "branches" WHERE "companyId" = $1)
             OR ura."companyGroupId" IN (
               SELECT "companyGroupId" FROM "companies" WHERE id = $1
             )
           )`,
        [companyId],
      );
      if (Number(found.rows[0]?.cnt ?? 0) === 0) {
        companiesMissingHr.push(companyId);
      }
    }
    evidence.companiesGettingHrStep = uniqueCompanies;
    evidence.companiesGettingHrStepMissingEligibleHr = companiesMissingHr;

    evidence.pass = {
      databaseIdentity:
        evidence.identity?.database_name === "dsp_erp_dev" &&
        evidence.identity?.current_schema === schema,
      duplicatesZero: evidence.duplicatesAllZero,
      workflowInventoryCaptured: classified.length > 0,
      baselineCountsCaptured: evidence.baselineCounts.length === 5,
      hrCoverageOk: companiesMissingHr.length === 0,
    };
    evidence.overallPass = Object.values(evidence.pass).every(Boolean);

    const outPath = resolve(
      repoRoot,
      "docs/product/leave-policy-matrix-migration-phase2-evidence.json",
    );
    writeFileSync(outPath, JSON.stringify(evidence, null, 2), "utf8");
    console.log(JSON.stringify(evidence, null, 2));
    console.log(`\nWrote ${outPath}`);
    console.log(`OVERALL_PASS=${evidence.overallPass}`);
    if (!evidence.overallPass) process.exitCode = 2;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
