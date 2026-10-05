/**
 * Guarded remediation for the confirmed dsp_erp_dev / dsp_pms release blockers.
 *
 * Dry-run is the default:
 *   npm run remediate:release-readiness
 *
 * Apply requires stopped application traffic, verified backup evidence, and
 * exact expected counts:
 *   npm run remediate:release-readiness -- --apply \
 *     --expected-unassigned-users=15 \
 *     --expected-onboarding-links=1 \
 *     --backup-reference=<snapshot-or-logical-backup-reference>
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Redis from "ioredis";
import { Pool } from "pg";

const EXPECTED_DATABASE = "dsp_erp_dev";
const EXPECTED_SCHEMA = "dsp_pms";
const LOCK_KEY = "erp-release-readiness-remediation-v1";

function readArguments(argv) {
  const values = new Map();
  let apply = false;

  for (const argument of argv) {
    if (argument === "--apply") {
      apply = true;
      continue;
    }

    const separator = argument.indexOf("=");
    if (!argument.startsWith("--") || separator < 3) {
      throw new Error(`Unsupported argument: ${argument}`);
    }
    values.set(argument.slice(2, separator), argument.slice(separator + 1));
  }

  const readCount = (name) => {
    const value = values.get(name);
    if (value === undefined) {
      return undefined;
    }
    if (!/^\d+$/.test(value)) {
      throw new Error(`${name} must be a non-negative integer.`);
    }
    return Number(value);
  };

  return {
    apply,
    expectedUnassignedUsers: readCount("expected-unassigned-users"),
    expectedOnboardingLinks: readCount("expected-onboarding-links"),
    backupReference: values.get("backup-reference")?.trim(),
  };
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function createPool() {
  const databaseUrl = new URL(
    requiredEnvironment("DATABASE_URL").replace(
      /^postgres(?:ql)?\+asyncpg:\/\//i,
      "postgresql://",
    ),
  );
  databaseUrl.searchParams.delete("schema");

  const sslCaPath = process.env.DATABASE_SSL_CA?.trim();
  const ssl = sslCaPath
    ? {
        ca: readFileSync(resolve(sslCaPath), "utf8"),
        rejectUnauthorized: true,
      }
    : undefined;

  return new Pool({
    connectionString: databaseUrl.toString(),
    ssl,
    max: 1,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    options: `-c search_path=${EXPECTED_SCHEMA} -c statement_timeout=30000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=30000`,
  });
}

async function loadState(client, lockRows = false) {
  const rowLock = lockRows ? "FOR UPDATE OF u" : "";
  const unassignedUsers = (
    await client.query(`
      SELECT u."id"
      FROM "${EXPECTED_SCHEMA}"."users" u
      WHERE u."status" = 'ACTIVE'
        AND NOT EXISTS (
          SELECT 1
          FROM "${EXPECTED_SCHEMA}"."user_role_assignments" ura
          WHERE ura."userId" = u."id"
            AND ura."isActive" = true
        )
      ORDER BY u."id"
      ${rowLock}
    `)
  ).rows;

  const activeGlobalSuperAdministrators = Number(
    (
      await client.query(`
        SELECT COUNT(DISTINCT u."id")::int AS "count"
        FROM "${EXPECTED_SCHEMA}"."users" u
        JOIN "${EXPECTED_SCHEMA}"."user_role_assignments" ura
          ON ura."userId" = u."id"
         AND ura."isActive" = true
         AND ura."scope" = 'GLOBAL'
        JOIN "${EXPECTED_SCHEMA}"."roles" r
          ON r."id" = ura."roleId"
         AND r."isActive" = true
         AND r."code" = 'SUPER_ADMINISTRATOR'
        WHERE u."status" = 'ACTIVE'
      `)
    ).rows[0].count,
  );

  const onboardingLinks = (
    await client.query(`
      SELECT
        odt."id",
        otv."status"::text AS "versionStatus",
        COUNT(otg."id")::int AS "taskGroupCount"
      FROM "${EXPECTED_SCHEMA}"."OnboardingDepartmentTemplate" odt
      JOIN "${EXPECTED_SCHEMA}"."OnboardingTemplateVersion" otv
        ON otv."id" = odt."onboardingTemplateVersionId"
      JOIN "${EXPECTED_SCHEMA}"."OnboardingTemplate" ot
        ON ot."id" = otv."onboardingTemplateId"
      JOIN "${EXPECTED_SCHEMA}"."departments" d
        ON d."id" = odt."departmentId"
      LEFT JOIN "${EXPECTED_SCHEMA}"."OnboardingTaskGroup" otg
        ON otg."onboardingDepartmentTemplateId" = odt."id"
      WHERE odt."isActive" = true
        AND d."companyId" <> ot."companyId"
      GROUP BY odt."id", otv."status"
      ORDER BY odt."id"
    `)
  ).rows;

  return {
    unassignedUsers,
    activeGlobalSuperAdministrators,
    onboardingLinks,
  };
}

function assertSafeState(state) {
  if (state.activeGlobalSuperAdministrators < 1) {
    throw new Error(
      "Remediation aborted: no active assigned Global Super Administrator would remain.",
    );
  }

  const unsafeLinks = state.onboardingLinks.filter(
    (link) => link.versionStatus !== "DRAFT" || link.taskGroupCount !== 0,
  );
  if (unsafeLinks.length > 0) {
    throw new Error(
      `Remediation aborted: ${unsafeLinks.length} cross-company onboarding link(s) are published or have dependencies.`,
    );
  }
}

function assertApplyGuards(args, state) {
  if (!args.backupReference) {
    throw new Error(
      "--backup-reference is required for --apply and must identify a verified snapshot or logical backup.",
    );
  }
  if (
    args.expectedUnassignedUsers === undefined ||
    args.expectedOnboardingLinks === undefined
  ) {
    throw new Error(
      "--apply requires --expected-unassigned-users and --expected-onboarding-links.",
    );
  }
  if (args.expectedUnassignedUsers !== state.unassignedUsers.length) {
    throw new Error(
      `Expected ${args.expectedUnassignedUsers} unassigned active users, found ${state.unassignedUsers.length}.`,
    );
  }
  if (args.expectedOnboardingLinks !== state.onboardingLinks.length) {
    throw new Error(
      `Expected ${args.expectedOnboardingLinks} cross-company onboarding links, found ${state.onboardingLinks.length}.`,
    );
  }
}

async function invalidateRedisSessions(sessionIds) {
  if (sessionIds.length === 0 || process.env.REDIS_ENABLED !== "true") {
    return { attempted: 0, deleted: 0, redisEnabled: false };
  }

  const redis = new Redis({
    host: requiredEnvironment("REDIS_HOST"),
    port: Number(requiredEnvironment("REDIS_PORT")),
    password: process.env.REDIS_PASSWORD?.trim() || undefined,
    db: Number(process.env.REDIS_DB ?? "0"),
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? "1000"),
    commandTimeout: Number(process.env.REDIS_COMMAND_TIMEOUT_MS ?? "200"),
    retryStrategy: () => null,
  });

  try {
    await redis.connect();
    const prefix = process.env.REDIS_KEY_PREFIX ?? "dsp-pms:";
    const keys = sessionIds.map((id) => `${prefix}auth:session:${id}`);
    const deleted = await redis.del(...keys);
    return { attempted: keys.length, deleted, redisEnabled: true };
  } finally {
    redis.disconnect();
  }
}

const args = readArguments(process.argv.slice(2));
const configuredSchema = requiredEnvironment("DATABASE_SCHEMA");
if (configuredSchema !== EXPECTED_SCHEMA) {
  throw new Error(
    `Refusing to run: expected schema ${EXPECTED_SCHEMA}, received ${configuredSchema}.`,
  );
}

const pool = createPool();
let client;

try {
  client = await pool.connect();
  const identity = (
    await client.query(
      `SELECT current_database() AS "database", current_schema() AS "schema"`,
    )
  ).rows[0];

  if (
    identity.database !== EXPECTED_DATABASE ||
    identity.schema !== EXPECTED_SCHEMA
  ) {
    throw new Error(
      `Refusing to run against ${identity.database}.${identity.schema}; expected ${EXPECTED_DATABASE}.${EXPECTED_SCHEMA}.`,
    );
  }

  if (!args.apply) {
    const state = await loadState(client);
    assertSafeState(state);
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          database: identity.database,
          schema: identity.schema,
          activeUnassignedUsers: state.unassignedUsers.length,
          activeGlobalSuperAdministrators:
            state.activeGlobalSuperAdministrators,
          activeCrossCompanyOnboardingLinks: state.onboardingLinks.length,
          onboardingLinksSafeToDisable: state.onboardingLinks.every(
            (link) =>
              link.versionStatus === "DRAFT" && link.taskGroupCount === 0,
          ),
          changesApplied: false,
        },
        null,
        2,
      ),
    );
  } else {
    await client.query("BEGIN");
    let committed = false;
    try {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        LOCK_KEY,
      ]);
      const state = await loadState(client, true);
      assertSafeState(state);
      assertApplyGuards(args, state);

      const userIds = state.unassignedUsers.map((user) => user.id);
      const sessionIds =
        userIds.length === 0
          ? []
          : (
              await client.query(
                `
                  SELECT "id"
                  FROM "${EXPECTED_SCHEMA}"."auth_sessions"
                  WHERE "userId" = ANY($1::uuid[])
                    AND "revokedAt" IS NULL
                  ORDER BY "id"
                  FOR UPDATE
                `,
                [userIds],
              )
            ).rows.map((session) => session.id);

      if (userIds.length > 0) {
        const disabled = await client.query(
          `
            UPDATE "${EXPECTED_SCHEMA}"."users"
            SET
              "status" = 'DISABLED',
              "securityVersion" = "securityVersion" + 1,
              "updatedAt" = NOW()
            WHERE "id" = ANY($1::uuid[])
              AND "status" = 'ACTIVE'
            RETURNING "id"
          `,
          [userIds],
        );
        if (disabled.rowCount !== userIds.length) {
          throw new Error("User count changed during remediation.");
        }

        await client.query(
          `
            UPDATE "${EXPECTED_SCHEMA}"."auth_sessions"
            SET
              "revokedAt" = NOW(),
              "revocationReason" = 'UNASSIGNED_USER_DISABLED',
              "updatedAt" = NOW()
            WHERE "id" = ANY($1::uuid[])
              AND "revokedAt" IS NULL
          `,
          [sessionIds],
        );

        for (const userId of userIds) {
          await client.query(
            `
              INSERT INTO "${EXPECTED_SCHEMA}"."audit_logs"
                ("id", "entityName", "entityId", "action", "oldValue", "newValue", "createdAt")
              VALUES
                (gen_random_uuid(), 'User', $1, 'SECURITY_DISABLE_UNASSIGNED',
                 $2::jsonb, $3::jsonb, NOW())
            `,
            [
              userId,
              JSON.stringify({ status: "ACTIVE" }),
              JSON.stringify({
                status: "DISABLED",
                securityVersionIncremented: true,
                reason: "UNASSIGNED_ACTIVE_USER_REMEDIATION",
              }),
            ],
          );
        }
      }

      for (const link of state.onboardingLinks) {
        const disabled = await client.query(
          `
            UPDATE "${EXPECTED_SCHEMA}"."OnboardingDepartmentTemplate" odt
            SET "isActive" = false, "updatedAt" = NOW()
            FROM "${EXPECTED_SCHEMA}"."OnboardingTemplateVersion" otv
            WHERE odt."id" = $1
              AND otv."id" = odt."onboardingTemplateVersionId"
              AND odt."isActive" = true
              AND otv."status" = 'DRAFT'
              AND NOT EXISTS (
                SELECT 1
                FROM "${EXPECTED_SCHEMA}"."OnboardingTaskGroup" otg
                WHERE otg."onboardingDepartmentTemplateId" = odt."id"
              )
            RETURNING odt."id"
          `,
          [link.id],
        );
        if (disabled.rowCount !== 1) {
          throw new Error(
            "Onboarding link state changed during remediation; transaction aborted.",
          );
        }

        await client.query(
          `
            INSERT INTO "${EXPECTED_SCHEMA}"."audit_logs"
              ("id", "entityName", "entityId", "action", "oldValue", "newValue", "createdAt")
            VALUES
              (gen_random_uuid(), 'OnboardingDepartmentTemplate', $1,
               'SECURITY_DISABLE_CROSS_COMPANY_LINK', $2::jsonb, $3::jsonb, NOW())
          `,
          [
            link.id,
            JSON.stringify({ isActive: true }),
            JSON.stringify({
              isActive: false,
              reason: "CROSS_COMPANY_DRAFT_LINK_REMEDIATION",
            }),
          ],
        );
      }

      await client.query("COMMIT");
      committed = true;
      const redis = await invalidateRedisSessions(sessionIds);

      console.log(
        JSON.stringify(
          {
            mode: "apply",
            database: identity.database,
            schema: identity.schema,
            backupReferenceRecorded: true,
            disabledUsers: userIds.length,
            revokedSessions: sessionIds.length,
            disabledOnboardingLinks: state.onboardingLinks.length,
            redis,
            changesApplied: true,
          },
          null,
          2,
        ),
      );
    } finally {
      if (!committed) {
        await client.query("ROLLBACK");
      }
    }
  }
} finally {
  client?.release();
  await pool.end();
}
