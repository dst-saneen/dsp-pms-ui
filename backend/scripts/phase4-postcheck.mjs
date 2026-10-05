/**
 * Phase 4 A4 — post-migration validation against a target schema (read-only).
 * Usage: DATABASE_SCHEMA=... node scripts/phase4-postcheck.mjs
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

const schema = (process.env.DATABASE_SCHEMA || env.DATABASE_SCHEMA || "").trim();

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

try {
  const report = {
    schema,
    recordedAt: new Date().toISOString(),
    objects: (
      await q(`
      SELECT
        to_regclass('${schema}.user_invitations') IS NOT NULL AS user_invitations_exists,
        to_regclass('${schema}.password_reset_challenges') IS NOT NULL AS password_reset_challenges_exists,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = '${schema}' AND table_name = 'users' AND column_name = 'passwordHash'
            AND is_nullable = 'YES'
        ) AS password_hash_nullable,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = '${schema}' AND table_name = 'permissions' AND column_name = 'isTenantAssignable'
        ) AS is_tenant_assignable_exists,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = '${schema}' AND table_name = 'roles' AND column_name = 'companyGroupId'
        ) AS roles_company_group_id_exists,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = '${schema}' AND table_name = 'audit_logs' AND column_name = 'requestId'
        ) AS audit_request_id_exists
    `)
    )[0],
    tenantAssignablePermissions: await q(`
      SELECT "code"
      FROM "${schema}"."permissions"
      WHERE "isTenantAssignable" = true
      ORDER BY "code"
    `),
    rolePermissionCounts: await q(`
      SELECT r."code" AS role, COUNT(rp."id")::int AS permission_count
      FROM "${schema}"."roles" r
      LEFT JOIN "${schema}"."role_permissions" rp ON rp."roleId" = r."id"
      WHERE r."isSystem" = true
      GROUP BY r."code"
      ORDER BY r."code"
    `),
    platformAdminOnTenantRoles: await q(`
      SELECT r."code" AS role
      FROM "${schema}"."roles" r
      JOIN "${schema}"."role_permissions" rp ON rp."roleId" = r."id"
      JOIN "${schema}"."permissions" p ON p."id" = rp."permissionId"
      WHERE p."code" = 'platform.admin' AND r."code" <> 'SUPER_ADMINISTRATOR'
    `),
    coreIndexes: await q(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = '${schema}'
        AND indexname IN (
          'companies_companyGroupId_idx',
          'departments_companyId_idx',
          'employees_companyId_idx',
          'employees_branchId_idx',
          'employees_departmentId_idx',
          'employees_designationId_idx',
          'employees_managerId_idx',
          'auth_sessions_activeCompanyGroupId_idx',
          'auth_sessions_activeCompanyId_idx',
          'auth_sessions_activeBranchId_idx',
          'user_role_assignments_roleId_idx',
          'users_defaultCompanyId_idx',
          'users_defaultBranchId_idx',
          'leave_requests_leaveBalanceId_idx',
          'attendances_shiftId_idx'
        )
      ORDER BY indexname
    `),
    appliedPendingMigrations: await q(`
      SELECT migration_name, finished_at
      FROM "${schema}"."_prisma_migrations"
      WHERE migration_name IN (
        '20260731190000_security_tenant_roles_and_account_recovery',
        '20260803120000_activate_tenant_workforce_permissions_and_core_fk_indexes'
      )
      ORDER BY migration_name
    `),
  };

  console.log(JSON.stringify(report, null, 2));
} finally {
  await pool.end();
}
