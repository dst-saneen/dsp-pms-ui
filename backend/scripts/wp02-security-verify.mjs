/**
 * WP-02 — permission / workflow step verification (read-only).
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

const expectedPermissions = [
  "hr.schedule.read",
  "hr.schedule.manage",
  "hr.schedule.publish",
  "hr.holidays.read",
  "hr.holidays.manage",
  "hr.attendance.regularize",
  "hr.attendance.lock",
  "hr.overtime.read",
  "hr.overtime.manage",
  "hr.overtime.approve",
  "hr.comp-off.read",
  "hr.comp-off.manage",
  "hr.calendar.read",
  "hr.team.read",
  "hr.team.approve",
];

try {
  const permissions = (
    await pool.query(
      `SELECT code FROM ${S}."permissions"
       WHERE code = ANY($1::text[])
       ORDER BY 1`,
      [expectedPermissions],
    )
  ).rows.map((r) => r.code);

  const grants = (
    await pool.query(
      `SELECT r.code AS role, COUNT(*)::int AS c
       FROM ${S}."role_permissions" rp
       JOIN ${S}."roles" r ON r.id = rp."roleId"
       JOIN ${S}."permissions" p ON p.id = rp."permissionId"
       WHERE p.code = ANY($1::text[])
       GROUP BY r.code
       ORDER BY 1`,
      [expectedPermissions],
    )
  ).rows;

  const workflowSteps = (
    await pool.query(
      `SELECT aw."scopeKey", COUNT(s.id)::int AS steps
       FROM ${S}."approval_workflows" aw
       LEFT JOIN ${S}."approval_workflow_steps" s ON s."workflowId" = aw.id
       WHERE aw."scopeKey" IN (
         'GLOBAL:LEAVE_APPROVAL',
         'GLOBAL:ATTENDANCE_REGULARIZATION',
         'GLOBAL:OVERTIME_APPROVAL'
       )
       GROUP BY 1
       ORDER BY 1`,
    )
  ).rows;

  const report = {
    recordedAt: new Date().toISOString(),
    purpose: "WP-02 permissions and approval resolution verification",
    database: {
      name: url.pathname.replace(/^\//, ""),
      schema,
      host: url.hostname,
    },
    permissionsPresent: permissions,
    missingPermissions: expectedPermissions.filter(
      (code) => !permissions.includes(code),
    ),
    roleGrantCounts: grants,
    workflowSteps,
    acceptance: {
      allPermissionsPresent: permissions.length === expectedPermissions.length,
      ownerHasAll:
        Number(grants.find((g) => g.role === "ORGANIZATION_OWNER")?.c) === 15,
      hrHasAll: Number(grants.find((g) => g.role === "HR_MANAGER")?.c) === 15,
      pmHasTeamCalendar:
        Number(grants.find((g) => g.role === "PROJECT_MANAGER")?.c) === 3,
      globalWorkflowsHaveStep1: workflowSteps.every((w) => Number(w.steps) >= 1),
    },
  };

  const outPath = resolve("..", "docs", "evidence", "wp-02-security-verify.json");
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
