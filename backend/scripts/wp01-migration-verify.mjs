/**
 * WP-01 — Post-migration verification (read-only counts + presence checks).
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

const S = `"${schema}"`;

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

const requiredTables = [
  "shift_rosters",
  "shift_roster_entries",
  "shift_roster_overrides",
  "attendance_policies",
  "attendance_exceptions",
  "attendance_regularizations",
  "attendance_periods",
  "leave_balance_transactions",
  "overtime_policies",
  "overtime_requests",
  "comp_off_credits",
  "comp_off_allocations",
  "user_notifications",
  "outbox_events",
];

try {
  const tableChecks = await Promise.all(
    requiredTables.map(async (table) => {
      const rows = await q(
        `SELECT COUNT(*)::int AS c FROM information_schema.tables
         WHERE table_schema = '${schema}' AND table_name = '${table}'`,
      );
      return { table, present: Number(rows[0].c) === 1 };
    }),
  );

  const counts = await Promise.all([
    count("companies", `SELECT COUNT(*)::int AS c FROM ${S}."companies"`),
    count("attendance", `SELECT COUNT(*)::int AS c FROM ${S}."attendances"`),
    count(
      "attendanceWithScheduleSnapshot",
      `SELECT COUNT(*)::int AS c FROM ${S}."attendances" WHERE "scheduledStartAt" IS NOT NULL`,
    ),
    count("leaveTypes", `SELECT COUNT(*)::int AS c FROM ${S}."leave_types"`),
    count(
      "activeCompOffLeaveTypes",
      `SELECT COUNT(*)::int AS c FROM ${S}."leave_types" WHERE "category" = 'COMP_OFF' AND "isActive" = true`,
    ),
    count(
      "companiesMissingActiveCompOff",
      `SELECT COUNT(*)::int AS c FROM ${S}."companies" c
       WHERE NOT EXISTS (
         SELECT 1 FROM ${S}."leave_types" lt
         WHERE lt."companyId" = c."id" AND lt."category" = 'COMP_OFF' AND lt."isActive" = true
       )`,
    ),
    count(
      "approvalWorkflows",
      `SELECT COUNT(*)::int AS c FROM ${S}."approval_workflows"`,
    ),
    count(
      "workforceGlobalWorkflows",
      `SELECT COUNT(*)::int AS c FROM ${S}."approval_workflows"
       WHERE "scopeKey" IN (
         'GLOBAL:LEAVE_APPROVAL',
         'GLOBAL:ATTENDANCE_REGULARIZATION',
         'GLOBAL:OVERTIME_APPROVAL'
       )`,
    ),
    count(
      "leaveBalanceTransactions",
      `SELECT COUNT(*)::int AS c FROM ${S}."leave_balance_transactions"`,
    ),
    count(
      "openingSnapshots",
      `SELECT COUNT(*)::int AS c FROM ${S}."leave_balance_transactions" WHERE "transactionType" = 'OPENING_SNAPSHOT'`,
    ),
    count("shiftRosters", `SELECT COUNT(*)::int AS c FROM ${S}."shift_rosters"`),
    count(
      "attendancePolicies",
      `SELECT COUNT(*)::int AS c FROM ${S}."attendance_policies"`,
    ),
    count(
      "overtimePolicies",
      `SELECT COUNT(*)::int AS c FROM ${S}."overtime_policies"`,
    ),
    count(
      "shiftsGraceDefault30",
      `SELECT COUNT(*)::int AS c FROM information_schema.columns
       WHERE table_schema = '${schema}' AND table_name = 'shifts'
         AND column_name = 'graceInMinutes' AND column_default LIKE '%30%'`,
    ),
  ]);

  const constraints = await Promise.all([
    count(
      "leaveLedgerImmutableTrigger",
      `SELECT COUNT(*)::int AS c FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = '${schema}'
         AND c.relname = 'leave_balance_transactions'
         AND t.tgname = 'trg_leave_balance_transactions_no_update'
         AND NOT t.tgisinternal`,
    ),
    count(
      "partialUniqueCompOffLeaveType",
      `SELECT COUNT(*)::int AS c FROM pg_indexes
       WHERE schemaname = '${schema}'
         AND indexname = 'ux_leave_types_one_active_comp_off_per_company'`,
    ),
    count(
      "rosterPeriodCheck",
      `SELECT COUNT(*)::int AS c FROM information_schema.table_constraints
       WHERE table_schema = '${schema}'
         AND table_name = 'shift_rosters'
         AND constraint_name = 'shift_rosters_period_range_check'`,
    ),
  ]);

  let migration = null;
  try {
    migration = (
      await q(
        `SELECT migration_name, finished_at
         FROM ${S}."_prisma_migrations"
         WHERE migration_name = '20260805120000_workforce_time_management_foundation'
         ORDER BY finished_at DESC LIMIT 1`,
      )
    )[0];
  } catch {
    migration = (
      await q(
        `SELECT migration_name, finished_at
         FROM public."_prisma_migrations"
         WHERE migration_name = '20260805120000_workforce_time_management_foundation'
         ORDER BY finished_at DESC LIMIT 1`,
      )
    )[0];
  }

  const report = {
    recordedAt: new Date().toISOString(),
    purpose: "WP-01 workforce migration verification",
    database: {
      name: url.pathname.replace(/^\//, ""),
      schema,
      host: url.hostname,
    },
    migration: migration ?? null,
    tables: tableChecks,
    counts: Object.fromEntries(counts.map((c) => [c.label, c])),
    constraints: Object.fromEntries(constraints.map((c) => [c.label, c])),
    acceptance: {
      allTablesPresent: tableChecks.every((t) => t.present),
      everyCompanyHasActiveCompOff:
        counts.find((c) => c.label === "companiesMissingActiveCompOff")
          ?.value === 0,
      workforceWorkflowsPresent:
        counts.find((c) => c.label === "workforceGlobalWorkflows")?.value ===
        3,
      historicalAttendanceUnsnapshotted:
        counts.find((c) => c.label === "attendanceWithScheduleSnapshot")
          ?.value === 0,
      ledgerTriggerPresent:
        constraints.find((c) => c.label === "leaveLedgerImmutableTrigger")
          ?.value === 1,
    },
  };

  const outPath = resolve(
    "..",
    "docs",
    "evidence",
    "wp-01-migration-verify.json",
  );
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote ${outPath}`);

  const failed = Object.entries(report.acceptance).filter(([, ok]) => !ok);
  if (failed.length) {
    console.error("Acceptance failures:", failed.map(([k]) => k).join(", "));
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}
