/**
 * WP-00 — Read-only workforce preflight counts (no mutations).
 * Safe to run against configured DATABASE_URL.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

const env = Object.fromEntries(
  readFileSync(resolve(".env"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const schema = env.DATABASE_SCHEMA?.trim();
if (!schema || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
  throw new Error("Invalid DATABASE_SCHEMA");
}

const url = new URL(
  env.DATABASE_URL.replace(/^postgres(?:ql)?\+asyncpg:\/\//i, "postgresql://"),
);
url.searchParams.delete("schema");

const pool = new Pool({
  connectionString: url.toString(),
  ssl: env.DATABASE_SSL_CA
    ? {
        ca: readFileSync(resolve(env.DATABASE_SSL_CA), "utf8"),
        rejectUnauthorized: true,
      }
    : undefined,
});

const q = async (sql) => (await pool.query(sql)).rows;

async function count(label, sql) {
  try {
    const rows = await q(sql);
    return { label, value: Number(rows[0].c) };
  } catch (error) {
    return { label, value: null, error: String(error.message || error) };
  }
}

async function distinct(label, sql) {
  try {
    const rows = await q(sql);
    return { label, values: rows.map((r) => r.v) };
  } catch (error) {
    return { label, values: [], error: String(error.message || error) };
  }
}

try {
  const version = (await q("SELECT version() AS v"))[0].v;
  const counts = await Promise.all([
    count("companies", `SELECT COUNT(*)::int AS c FROM "${schema}"."companies"`),
    count("branches", `SELECT COUNT(*)::int AS c FROM "${schema}"."branches"`),
    count(
      "branchWorkingDays",
      `SELECT COUNT(*)::int AS c FROM "${schema}"."branch_working_days"`,
    ),
    count("shifts", `SELECT COUNT(*)::int AS c FROM "${schema}"."shifts"`),
    count(
      "employeeShifts",
      `SELECT COUNT(*)::int AS c FROM "${schema}"."employee_shifts"`,
    ),
    count("holidays", `SELECT COUNT(*)::int AS c FROM "${schema}"."holidays"`),
    count("leaveTypes", `SELECT COUNT(*)::int AS c FROM "${schema}"."leave_types"`),
    count(
      "leaveBalances",
      `SELECT COUNT(*)::int AS c FROM "${schema}"."employee_leave_balances"`,
    ),
    count(
      "leaveRequests",
      `SELECT COUNT(*)::int AS c FROM "${schema}"."leave_requests"`,
    ),
    count("attendance", `SELECT COUNT(*)::int AS c FROM "${schema}"."attendances"`),
    count(
      "approvalWorkflows",
      `SELECT COUNT(*)::int AS c FROM "${schema}"."approval_workflows"`,
    ),
    count(
      "approvalWorkflowSteps",
      `SELECT COUNT(*)::int AS c FROM "${schema}"."approval_workflow_steps"`,
    ),
    count("employees", `SELECT COUNT(*)::int AS c FROM "${schema}"."employees"`),
    count(
      "branchesMissingTimezone",
      `SELECT COUNT(*)::int AS c FROM "${schema}"."branches" WHERE "timezone" IS NULL OR btrim("timezone") = ''`,
    ),
    count(
      "newWorkforceTables_shiftRosters",
      `SELECT COUNT(*)::int AS c FROM information_schema.tables WHERE table_schema = '${schema}' AND table_name = 'shift_rosters'`,
    ),
  ]);

  const distincts = await Promise.all([
    distinct(
      "holidayType",
      `SELECT DISTINCT "holidayType" AS v FROM "${schema}"."holidays" ORDER BY 1`,
    ),
    distinct(
      "leaveRequestStatus",
      `SELECT DISTINCT "status"::text AS v FROM "${schema}"."leave_requests" ORDER BY 1`,
    ),
    distinct(
      "attendanceStatus",
      `SELECT DISTINCT "status"::text AS v FROM "${schema}"."attendances" ORDER BY 1`,
    ),
    distinct(
      "attendanceSource",
      `SELECT DISTINCT "source"::text AS v FROM "${schema}"."attendances" ORDER BY 1`,
    ),
    distinct(
      "attendanceApprovalStatus",
      `SELECT DISTINCT "approvalStatus"::text AS v FROM "${schema}"."attendances" ORDER BY 1`,
    ),
    distinct(
      "approvalWorkflowCodes",
      `SELECT DISTINCT "workflowCode" AS v FROM "${schema}"."approval_workflows" ORDER BY 1`,
    ),
  ]);

  const report = {
    recordedAt: new Date().toISOString(),
    purpose: "WP-00 workforce preflight (read-only)",
    database: {
      name: env.DATABASE_NAME,
      schema,
      host: env.DATABASE_HOST,
      isAwsRds: String(env.DATABASE_HOST || "").includes("rds.amazonaws.com"),
      disposable: false,
      warning:
        "Configured target is shared AWS dsp_erp_dev — NOT disposable. WP-01 migrate create/apply must use a local disposable dsp_pms database.",
    },
    postgresVersion: version,
    counts: Object.fromEntries(counts.map((c) => [c.label, c])),
    distinctValues: Object.fromEntries(distincts.map((d) => [d.label, d])),
  };

  const outPath = resolve("..", "docs", "evidence", "wp-00-workforce-preflight.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log("Wrote", outPath);
} finally {
  await pool.end();
}
