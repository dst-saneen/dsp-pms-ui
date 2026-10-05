/**
 * Phase 4 A3 — read-only migration preflight against the configured DATABASE_URL.
 * Does not apply migrations or mutate data.
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
  throw new Error("DATABASE_SCHEMA must be a valid PostgreSQL identifier.");
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
  options: `-c search_path=${schema}`,
});

const q = async (sql) => (await pool.query(sql)).rows;

async function main() {
  const report = {
    recordedAt: new Date().toISOString(),
    schema,
    counts: {},
    checks: {},
  };

  const countTables = [
    ["companyGroups", "company_groups"],
    ["companies", "companies"],
    ["branches", "branches"],
    ["employees", "employees"],
    ["users", "users"],
    ["roles", "roles"],
    ["permissions", "permissions"],
    ["rolePermissions", "role_permissions"],
    ["userRoleAssignments", "user_role_assignments"],
    ["authSessions", "auth_sessions"],
    ["pendingRegistrations", "pending_registrations"],
    ["auditLogs", "audit_logs"],
  ];

  for (const [label, table] of countTables) {
    report.counts[label] = (
      await q(`SELECT COUNT(*)::int AS count FROM "${schema}"."${table}"`)
    )[0].count;
  }

  report.checks.userStatusDistribution = await q(`
    SELECT "status"::text AS status, COUNT(*)::int AS count
    FROM "${schema}"."users"
    GROUP BY "status"
    ORDER BY "status"
  `);

  report.checks.nullPasswordByStatus = await q(`
    SELECT
      "status"::text AS status,
      COUNT(*) FILTER (WHERE "passwordHash" IS NULL)::int AS null_password,
      COUNT(*) FILTER (WHERE "passwordHash" IS NOT NULL)::int AS has_password
    FROM "${schema}"."users"
    GROUP BY "status"
    ORDER BY "status"
  `);

  report.checks.duplicateSystemRoleCodes = await q(`
    SELECT "code", COUNT(*)::int AS count
    FROM "${schema}"."roles"
    WHERE "isSystem" = true
    GROUP BY "code"
    HAVING COUNT(*) > 1
  `);

  report.checks.orphanedRoleAssignments = (
    await q(`
    SELECT COUNT(*)::int AS count
    FROM "${schema}"."user_role_assignments" ura
    LEFT JOIN "${schema}"."users" u ON u."id" = ura."userId"
    LEFT JOIN "${schema}"."roles" r ON r."id" = ura."roleId"
    WHERE u."id" IS NULL OR r."id" IS NULL
  `)
  )[0];

  report.checks.tablesWithoutPrimaryKey = await q(`
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = '${schema}'
      AND c.relkind = 'r'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint con
        WHERE con.conrelid = c.oid AND con.contype = 'p'
      )
    ORDER BY c.relname
  `);

  report.checks.pendingSecurityObjects = (
    await q(`
    SELECT
      to_regclass('${schema}.user_invitations') IS NOT NULL AS user_invitations_exists,
      to_regclass('${schema}.password_reset_challenges') IS NOT NULL AS password_reset_challenges_exists,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = '${schema}'
          AND table_name = 'permissions'
          AND column_name = 'isTenantAssignable'
      ) AS permissions_is_tenant_assignable_exists,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = '${schema}'
          AND table_name = 'roles'
          AND column_name = 'companyGroupId'
      ) AS roles_company_group_id_exists
  `)
  )[0];

  report.checks.existingCoreIndexes = await q(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = '${schema}'
      AND tablename IN (
        'companies', 'departments', 'employees', 'auth_sessions',
        'user_role_assignments', 'users', 'leave_requests', 'attendances'
      )
      AND (
        indexdef ILIKE '%(companyGroupId)%'
        OR indexdef ILIKE '%(companyId)%'
        OR indexdef ILIKE '%(branchId)%'
        OR indexdef ILIKE '%(departmentId)%'
        OR indexdef ILIKE '%(designationId)%'
        OR indexdef ILIKE '%(managerId)%'
        OR indexdef ILIKE '%(activeCompanyGroupId)%'
        OR indexdef ILIKE '%(activeCompanyId)%'
        OR indexdef ILIKE '%(activeBranchId)%'
        OR indexdef ILIKE '%(roleId)%'
        OR indexdef ILIKE '%(defaultCompanyId)%'
        OR indexdef ILIKE '%(defaultBranchId)%'
        OR indexdef ILIKE '%(leaveBalanceId)%'
        OR indexdef ILIKE '%(shiftId)%'
      )
    ORDER BY tablename, indexname
  `);

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
