/**
 * Phase 5 — verify B3 system-role permission matrix on the live schema (read-only).
 */
import { readFileSync } from "node:fs";
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

const expected = {
  ORGANIZATION_OWNER: [
    "dashboard.read",
    "security.users.read",
    "security.users.manage",
    "security.roles.read",
    "security.roles.manage",
    "organization.company-groups.read",
    "organization.company-groups.manage",
    "organization.companies.read",
    "organization.companies.manage",
    "organization.branches.read",
    "organization.branches.manage",
    "organization.structure.read",
    "organization.structure.manage",
    "hr.employees.read",
    "hr.employees.manage",
    "hr.onboarding.read",
    "hr.onboarding.manage",
    "hr.documents.read",
    "hr.documents.manage",
    "hr.leave.read",
    "hr.leave.manage",
    "hr.attendance.read",
    "hr.attendance.manage",
    "assets.assets.read",
    "assets.assets.manage",
    "assets.assignments.read",
    "assets.assignments.manage",
    "hr.self.read",
    "hr.self.manage",
  ],
  COMPANY_ADMINISTRATOR: [
    "dashboard.read",
    "security.users.read",
    "security.users.manage",
    "security.roles.read",
    "security.roles.manage",
    "organization.companies.read",
    "organization.companies.manage",
    "organization.branches.read",
    "organization.branches.manage",
    "organization.structure.read",
    "organization.structure.manage",
    "hr.employees.read",
    "hr.employees.manage",
    "hr.onboarding.read",
    "hr.onboarding.manage",
    "hr.documents.read",
    "hr.documents.manage",
    "hr.leave.read",
    "hr.leave.manage",
    "hr.attendance.read",
    "hr.attendance.manage",
    "assets.assets.read",
    "assets.assets.manage",
    "assets.assignments.read",
    "assets.assignments.manage",
    "hr.self.read",
    "hr.self.manage",
  ],
  HR_MANAGER: [
    "dashboard.read",
    "organization.companies.read",
    "organization.branches.read",
    "organization.structure.read",
    "hr.employees.read",
    "hr.employees.manage",
    "hr.onboarding.read",
    "hr.onboarding.manage",
    "hr.documents.read",
    "hr.documents.manage",
    "hr.leave.read",
    "hr.leave.manage",
    "hr.attendance.read",
    "hr.attendance.manage",
    "assets.assets.read",
    "assets.assignments.read",
    "hr.self.read",
    "hr.self.manage",
  ],
  PROJECT_MANAGER: [
    "dashboard.read",
    "organization.companies.read",
    "organization.branches.read",
    "organization.structure.read",
    "hr.employees.read",
    "hr.self.read",
    "hr.self.manage",
  ],
  ASSET_MANAGER: [
    "dashboard.read",
    "organization.companies.read",
    "organization.branches.read",
    "organization.structure.read",
    "hr.employees.read",
    "assets.assets.read",
    "assets.assets.manage",
    "assets.assignments.read",
    "assets.assignments.manage",
    "hr.self.read",
    "hr.self.manage",
  ],
  EMPLOYEE: ["dashboard.read", "hr.self.read", "hr.self.manage"],
  SUPER_ADMINISTRATOR: ["platform.admin"],
};

try {
  const rows = (
    await pool.query(`
    SELECT r."code" AS role, p."code" AS permission
    FROM "${schema}"."roles" r
    JOIN "${schema}"."role_permissions" rp ON rp."roleId" = r."id"
    JOIN "${schema}"."permissions" p ON p."id" = rp."permissionId"
    WHERE r."isSystem" = true
    ORDER BY r."code", p."code"
  `)
  ).rows;

  const actual = {};
  for (const row of rows) {
    actual[row.role] ??= [];
    actual[row.role].push(row.permission);
  }

  const report = { recordedAt: new Date().toISOString(), schema, roles: {} };
  let ok = true;

  for (const [role, perms] of Object.entries(expected)) {
    const have = new Set(actual[role] || []);
    const missing = perms.filter((p) => !have.has(p));
    const unexpectedPlatform =
      role !== "SUPER_ADMINISTRATOR" && have.has("platform.admin");
    const extra = [...have].filter((p) => !perms.includes(p));
    const pass = missing.length === 0 && !unexpectedPlatform;
    if (!pass) ok = false;
    report.roles[role] = {
      pass,
      missing,
      unexpectedPlatformAdmin: unexpectedPlatform,
      extra,
      count: have.size,
    };
  }

  report.pass = ok;
  console.log(JSON.stringify(report, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  await pool.end();
}
