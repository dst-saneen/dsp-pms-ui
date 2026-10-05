/**
 * Phase H — B0 migration validation on a disposable PostgreSQL schema only.
 *
 * Usage:
 *   node scripts/leave-b0-disposable-validate.mjs preflight
 *   B0_VALIDATE_DATABASE_URL=postgresql://... node scripts/leave-b0-disposable-validate.mjs apply
 *
 * Safety:
 * - Refuses database names containing dsp_erp_dev unless B0_ALLOW_SHARED_DEV=1
 * - Never reads backend/.env; caller must pass B0_VALIDATE_DATABASE_URL explicitly
 * - Creates an isolated schema, runs migrate deploy twice, verifies B0 objects, then drops it
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, "..");
const migrationPath = resolve(
  backendRoot,
  "prisma/migrations/20260811120000_leave_policy_matrix_and_manager_hr_approval/migration.sql",
);

const mode = process.argv[2] ?? "preflight";
const blockedDbFragments = ["dsp_erp_dev"];

const duplicatePolicyQueries = [
  {
    name: "branch default",
    sql: `
      SELECT "companyId", "branchId", "leaveTypeId", COUNT(*)::int AS duplicate_count
      FROM "leave_policies"
      WHERE "isActive" = true
        AND "departmentId" IS NULL
        AND "designationId" IS NULL
      GROUP BY 1, 2, 3
      HAVING COUNT(*) > 1
    `,
  },
  {
    name: "branch + department",
    sql: `
      SELECT "companyId", "branchId", "departmentId", "leaveTypeId", COUNT(*)::int AS duplicate_count
      FROM "leave_policies"
      WHERE "isActive" = true
        AND "departmentId" IS NOT NULL
        AND "designationId" IS NULL
      GROUP BY 1, 2, 3, 4
      HAVING COUNT(*) > 1
    `,
  },
  {
    name: "branch + designation",
    sql: `
      SELECT "companyId", "branchId", "designationId", "leaveTypeId", COUNT(*)::int AS duplicate_count
      FROM "leave_policies"
      WHERE "isActive" = true
        AND "departmentId" IS NULL
        AND "designationId" IS NOT NULL
      GROUP BY 1, 2, 3, 4
      HAVING COUNT(*) > 1
    `,
  },
  {
    name: "branch + department + designation",
    sql: `
      SELECT "companyId", "branchId", "departmentId", "designationId", "leaveTypeId", COUNT(*)::int AS duplicate_count
      FROM "leave_policies"
      WHERE "isActive" = true
        AND "departmentId" IS NOT NULL
        AND "designationId" IS NOT NULL
      GROUP BY 1, 2, 3, 4, 5
      HAVING COUNT(*) > 1
    `,
  },
];

function assertSafeDatabaseUrl(rawUrl) {
  if (!rawUrl?.trim()) {
    throw new Error(
      "Set B0_VALIDATE_DATABASE_URL to a disposable PostgreSQL database (without reading .env).",
    );
  }

  const normalized = rawUrl
    .trim()
    .replace(/^postgres(?:ql)?\+asyncpg:\/\//i, "postgresql://");
  const url = new URL(normalized);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ""));

  for (const fragment of blockedDbFragments) {
    if (dbName.includes(fragment) && process.env.B0_ALLOW_SHARED_DEV !== "1") {
      throw new Error(
        `Refusing ${dbName}. Use a disposable database name or set B0_ALLOW_SHARED_DEV=1 only when ops explicitly approves.`,
      );
    }
  }

  return { url, dbName };
}

function withSchema(baseUrl, schema) {
  const url = new URL(baseUrl.toString());
  url.searchParams.set("schema", schema);
  return url.toString();
}

function withoutSchema(baseUrl) {
  const url = new URL(baseUrl.toString());
  url.searchParams.delete("schema");
  return url.toString();
}

function runPrismaMigrateDeploy(databaseUrl, schemaName) {
  const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: backendRoot,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      // prisma.config.ts forces schema from DATABASE_SCHEMA — must override
      // or deploy lands in shared dsp_pms instead of the disposable schema.
      DATABASE_SCHEMA: schemaName,
    },
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    throw new Error("prisma migrate deploy failed");
  }
}

async function verifyB0Objects(pool) {
  const indexNames = [
    "leave_policies_active_branch_default_uidx",
    "leave_policies_active_branch_dept_uidx",
    "leave_policies_active_branch_designation_uidx",
    "leave_policies_active_branch_dept_designation_uidx",
    "approval_transaction_steps_approverId_status_stepNo_idx",
    "leave_requests_status_submittedAt_idx",
  ];

  for (const indexName of indexNames) {
    const { rows } = await pool.query(
      `
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = current_schema()
          AND indexname = $1
        LIMIT 1
      `,
      [indexName],
    );
    if (rows.length === 0) {
      throw new Error(`Expected index ${indexName} was not created`);
    }
  }

  const { rows: globalSteps } = await pool.query(
    `
      SELECT COUNT(*)::int AS step_count
      FROM "approval_workflow_steps" s
      JOIN "approval_workflows" aw ON aw."id" = s."workflowId"
      WHERE aw."scopeKey" = 'GLOBAL:LEAVE_APPROVAL'
        AND aw."isActive" = true
    `,
  );
  if ((globalSteps[0]?.step_count ?? 0) < 2) {
    throw new Error(
      "Expected GLOBAL:LEAVE_APPROVAL to have at least two workflow steps after B0",
    );
  }
}

async function assertNoDuplicatePolicies(pool) {
  for (const query of duplicatePolicyQueries) {
    const { rows } = await pool.query(query.sql);
    if (rows.length > 0) {
      throw new Error(
        `Duplicate active leave policies found (${query.name}); resolve before applying B0 to a shared target`,
      );
    }
  }
}

function runPreflight() {
  if (!existsSync(migrationPath)) {
    throw new Error(`Missing migration file: ${migrationPath}`);
  }

  const sql = readFileSync(migrationPath, "utf8");
  const checks = [
    ["partial unique indexes", /CREATE UNIQUE INDEX IF NOT EXISTS "leave_policies_active_branch_default_uidx"/.test(sql)],
    ["queue index", /approval_transaction_steps_approverId_status_stepNo_idx/.test(sql)],
    ["global HR step", /GLOBAL:LEAVE_APPROVAL/.test(sql)],
    ["idempotent guards", /IF NOT EXISTS/.test(sql)],
  ];

  console.log("B0 preflight OK");
  console.log(`Migration: ${migrationPath}`);
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    if (!ok) {
      process.exitCode = 1;
    }
  }

  console.log("\nDuplicate-policy queries to run on the target before apply:");
  for (const query of duplicatePolicyQueries) {
    console.log(`\n-- ${query.name}\n${query.sql.trim()}`);
  }

  console.log(
    "\nApply only with:\n  B0_VALIDATE_DATABASE_URL=postgresql://... node scripts/leave-b0-disposable-validate.mjs apply",
  );
}

async function runApply() {
  const { url } = assertSafeDatabaseUrl(process.env.B0_VALIDATE_DATABASE_URL);
  const schema =
    process.env.DISPOSABLE_SCHEMA?.trim() ||
    `leave_b0_disposable_${Date.now().toString(36)}`;

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error("Invalid DISPOSABLE_SCHEMA");
  }

  const adminPool = new Pool({
    connectionString: withoutSchema(url),
    ssl: process.env.DATABASE_SSL_CA
      ? {
          ca: readFileSync(resolve(backendRoot, process.env.DATABASE_SSL_CA), "utf8"),
          rejectUnauthorized: true,
        }
      : undefined,
  });

  let schemaPool;
  try {
    await adminPool.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    console.log(`Created disposable schema ${schema}`);

    const schemaUrl = withSchema(url, schema);
    runPrismaMigrateDeploy(schemaUrl, schema);
    console.log("First migrate deploy completed");

    schemaPool = new Pool({
      connectionString: schemaUrl,
      ssl: process.env.DATABASE_SSL_CA
        ? {
            ca: readFileSync(resolve(backendRoot, process.env.DATABASE_SSL_CA), "utf8"),
            rejectUnauthorized: true,
          }
        : undefined,
    });
    await schemaPool.query(`SET search_path TO "${schema}"`);
    await assertNoDuplicatePolicies(schemaPool);
    await verifyB0Objects(schemaPool);
    console.log("B0 objects verified on disposable schema");

    runPrismaMigrateDeploy(schemaUrl, schema);
    console.log("Second migrate deploy completed (idempotent re-run)");
  } finally {
    if (schemaPool) {
      await schemaPool.end();
    }
    if (process.env.KEEP_DISPOSABLE_SCHEMA !== "1") {
      await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      console.log(`Dropped disposable schema ${schema}`);
    } else {
      console.log(`KEEP_DISPOSABLE_SCHEMA=1 — left schema ${schema} in place`);
    }
    await adminPool.end();
  }

  console.log("B0 disposable validation passed");
}

try {
  if (mode === "preflight") {
    runPreflight();
  } else if (mode === "apply") {
    await runApply();
  } else {
    throw new Error("Usage: node scripts/leave-b0-disposable-validate.mjs <preflight|apply>");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
