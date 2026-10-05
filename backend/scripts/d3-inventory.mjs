import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';

const env = Object.fromEntries(
  readFileSync(resolve('.env'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const schema = env.DATABASE_SCHEMA;
const url = new URL(
  env.DATABASE_URL.replace(/^postgres(?:ql)?\+asyncpg:\/\//i, 'postgresql://'),
);
url.searchParams.delete('schema');

const pool = new Pool({
  connectionString: url.toString(),
  ssl: env.DATABASE_SSL_CA
    ? {
        ca: readFileSync(resolve(env.DATABASE_SSL_CA), 'utf8'),
        rejectUnauthorized: true,
      }
    : undefined,
  options: `-c search_path=${schema}`,
});

const q = async (sql) => (await pool.query(sql)).rows;

const tables = [
  'leave_types',
  'leave_policies',
  'employee_leave_balances',
  'leave_requests',
  'attendances',
  'shifts',
  'employee_shifts',
  'holidays',
  'employees',
  'branches',
];

try {
  const counts = {};
  for (const table of tables) {
    counts[table] = (
      await q(`SELECT COUNT(*)::int AS c FROM "${schema}"."${table}"`)
    )[0].c;
  }

  const report = {
    counts,
    leaveStatuses: await q(
      `SELECT status, COUNT(*)::int AS c FROM "${schema}".leave_requests GROUP BY status ORDER BY status`,
    ),
    attendanceStatuses: await q(
      `SELECT status, COUNT(*)::int AS c FROM "${schema}".attendances GROUP BY status ORDER BY status`,
    ),
    attendanceSources: await q(
      `SELECT source, COUNT(*)::int AS c FROM "${schema}".attendances GROUP BY source ORDER BY source`,
    ),
    attendanceApprovalStatuses: await q(
      `SELECT "approvalStatus", COUNT(*)::int AS c FROM "${schema}".attendances GROUP BY "approvalStatus" ORDER BY "approvalStatus"`,
    ),
    branchTimezones: await q(
      `SELECT timezone, COUNT(*)::int AS c FROM "${schema}".branches GROUP BY timezone ORDER BY timezone NULLS FIRST`,
    ),
    blankOrEmptyTimezoneBranches: (
      await q(
        `SELECT COUNT(*)::int AS c FROM "${schema}".branches WHERE timezone IS NULL OR btrim(timezone) = ''`,
      )
    )[0].c,
    invalidLeaveDateRanges: (
      await q(
        `SELECT COUNT(*)::int AS c FROM "${schema}".leave_requests WHERE "fromDate" > "toDate"`,
      )
    )[0].c,
    negativeBalanceFields: (
      await q(
        `SELECT COUNT(*)::int AS c FROM "${schema}".employee_leave_balances WHERE entitlement < 0 OR used < 0 OR pending < 0`,
      )
    )[0].c,
    checkoutBeforeCheckin: (
      await q(
        `SELECT COUNT(*)::int AS c FROM "${schema}".attendances WHERE "checkInTime" IS NOT NULL AND "checkOutTime" IS NOT NULL AND "checkOutTime" < "checkInTime"`,
      )
    )[0].c,
  };

  console.log(JSON.stringify(report, null, 2));
} finally {
  await pool.end();
}
