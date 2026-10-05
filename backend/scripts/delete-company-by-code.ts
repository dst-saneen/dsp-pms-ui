/**
 * One-off: inspect or hard-delete a company and its blocking dependents.
 *
 * Preview only:
 *   npx tsx scripts/delete-company-by-code.ts UAT-ATLAS-OPS
 *
 * Execute outside production:
 *   Set ALLOW_DESTRUCTIVE_DB_SCRIPTS=true, then pass:
 *   --execute --confirm=UAT-ATLAS-OPS
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool, type PoolClient } from 'pg';

import {
  assertQaStagingSentinel,
  assertQaWriteEnvironment,
  QA_STAGING_TARGET,
  type QaWriteTarget,
  type RawQueryClient,
} from './assert-destructive-db-guard';
import { requireSafeDatabaseSchema } from './create-prisma-client';

const companyCode = process.argv[2]?.trim();
const execute = process.argv.includes('--execute');
const confirmation = process.argv
  .find((argument) => argument.startsWith('--confirm='))
  ?.slice('--confirm='.length);

if (!companyCode) {
  console.error(
    'Usage: npx tsx scripts/delete-company-by-code.ts <COMPANY_CODE> [--execute --confirm=<COMPANY_CODE>]',
  );
  process.exit(1);
}

if (execute) {
  if (
    process.env.NODE_ENV !== 'development' &&
    process.env.NODE_ENV !== 'test'
  ) {
    throw new Error(
      'Company deletion is allowed only when NODE_ENV is development or test.',
    );
  }

  if (process.env.ALLOW_DESTRUCTIVE_DB_SCRIPTS !== 'true') {
    throw new Error(
      'Set ALLOW_DESTRUCTIVE_DB_SCRIPTS=true to enable destructive database scripts.',
    );
  }

  if (confirmation !== companyCode) {
    throw new Error(
      `Pass --confirm=${companyCode} to confirm the exact company code.`,
    );
  }
}

const writeTarget: QaWriteTarget | undefined = execute
  ? assertQaWriteEnvironment('delete-company-by-code')
  : undefined;

function buildPool() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const schema = requireSafeDatabaseSchema(process.env.DATABASE_SCHEMA);
  const sslCaPath = process.env.DATABASE_SSL_CA;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  if (schema.toLowerCase() === QA_STAGING_TARGET.currentSchema) {
    throw new Error(
      `Refusing current schema "${QA_STAGING_TARGET.currentSchema}". Use the approved staging schema instead.`,
    );
  }

  const runtimeUrl = new URL(
    databaseUrl.replace(/^postgres(?:ql)?\+asyncpg:\/\//i, 'postgresql://'),
  );
  runtimeUrl.searchParams.delete('schema');

  const ssl = sslCaPath
    ? {
        ca: readFileSync(resolve(process.cwd(), sslCaPath), 'utf8'),
        rejectUnauthorized: true,
      }
    : undefined;

  return {
    schema,
    pool: new Pool({
      connectionString: runtimeUrl.toString(),
      ssl,
      max: 5,
    }),
  };
}

function asRawQueryClient(client: PoolClient): RawQueryClient {
  return {
    async $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T> {
      const result = await client.query(query, values as never[]);
      return result.rows as T;
    },
  };
}

async function listFkRefs(
  client: PoolClient,
  schema: string,
  tableName: string,
  columnName = 'id',
) {
  const fks = await client.query<{
    table_name: string;
    column_name: string;
    delete_rule: string;
  }>(
    `SELECT
       tc.table_name,
       kcu.column_name,
       rc.delete_rule
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     JOIN information_schema.referential_constraints rc
       ON tc.constraint_name = rc.constraint_name
      AND tc.table_schema = rc.constraint_schema
     JOIN information_schema.constraint_column_usage ccu
       ON rc.unique_constraint_name = ccu.constraint_name
      AND rc.constraint_schema = ccu.constraint_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = $1
       AND ccu.table_name = $2
       AND ccu.column_name = $3
     ORDER BY tc.table_name`,
    [schema, tableName, columnName],
  );

  return fks.rows.filter(
    (fk) => fk.delete_rule !== 'CASCADE' && fk.delete_rule !== 'SET NULL',
  );
}

async function deleteByIds(
  client: PoolClient,
  schema: string,
  tableName: string,
  ids: string[],
  depth = 0,
): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }

  if (depth > 20) {
    throw new Error(`Dependency depth exceeded while deleting ${tableName}`);
  }

  const refs = await listFkRefs(client, schema, tableName);
  let total = 0;

  for (const ref of refs) {
    const childIds = await client.query<{ id: string }>(
      `SELECT DISTINCT "${ref.column_name}"::text AS id
       FROM "${ref.table_name}"
       WHERE "${ref.column_name}"::text = ANY($1::text[])`,
      [ids],
    );

    if ((childIds.rowCount ?? 0) === 0) {
      continue;
    }

    // Prefer deleting whole child rows by primary key when available.
    const pk = await client.query<{ column_name: string }>(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = $1
         AND tc.table_name = $2
         AND tc.constraint_type = 'PRIMARY KEY'
       ORDER BY kcu.ordinal_position
       LIMIT 1`,
      [schema, ref.table_name],
    );

    if (pk.rowCount === 1 && pk.rows[0].column_name === 'id') {
      const rows = await client.query<{ id: string }>(
        `SELECT id::text AS id
         FROM "${ref.table_name}"
         WHERE "${ref.column_name}"::text = ANY($1::text[])`,
        [ids],
      );
      total += await deleteByIds(
        client,
        schema,
        ref.table_name,
        rows.rows.map((row) => row.id),
        depth + 1,
      );
    } else {
      try {
        const deleted = await client.query(
          `DELETE FROM "${ref.table_name}"
           WHERE "${ref.column_name}"::text = ANY($1::text[])`,
          [ids],
        );
        const count = deleted.rowCount ?? 0;
        total += count;
        if (count > 0) {
          console.log(
            `${'  '.repeat(depth)}deleted ${count} from ${ref.table_name} via ${ref.column_name}`,
          );
        }
      } catch (error) {
        if (
          typeof error === 'object' &&
          error &&
          'code' in error &&
          (error as { code?: string }).code === '23503'
        ) {
          const maybeIds = await client.query<{ id: string }>(
            `SELECT id::text AS id
             FROM "${ref.table_name}"
             WHERE "${ref.column_name}"::text = ANY($1::text[])`,
            [ids],
          );
          if ((maybeIds.rowCount ?? 0) > 0) {
            total += await deleteByIds(
              client,
              schema,
              ref.table_name,
              maybeIds.rows.map((row) => row.id),
              depth + 1,
            );
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
      continue;
    }
  }

  const deleted = await client.query(
    `DELETE FROM "${tableName}" WHERE id::text = ANY($1::text[])`,
    [ids],
  );
  const count = deleted.rowCount ?? 0;
  total += count;
  if (count > 0) {
    console.log(`${'  '.repeat(depth)}deleted ${count} from ${tableName}`);
  }
  return total;
}

async function main() {
  const { schema, pool } = buildPool();
  const client = await pool.connect();

  try {
    await client.query(`SET search_path TO "${schema}"`);
    if (writeTarget) {
      await assertQaStagingSentinel(
        asRawQueryClient(client),
        'delete-company-by-code',
        writeTarget,
      );
    }
    await client.query('BEGIN');

    const companyResult = await client.query<{
      id: string;
      company_code: string;
      company_name: string;
    }>(
      `SELECT id, "companyCode" AS company_code, "companyName" AS company_name
       FROM companies
       WHERE "companyCode" = $1
       LIMIT 1`,
      [companyCode],
    );

    if (companyResult.rowCount === 0) {
      throw new Error(`Company not found: ${companyCode}`);
    }

    const company = companyResult.rows[0];
    console.log(
      `${execute ? 'Deleting' : 'Previewing'} company ${company.company_code} (${company.company_name}) id=${company.id}`,
    );

    if (!execute) {
      await client.query('ROLLBACK');
      console.log(
        'DRY RUN: no data changed. Use --execute with the exact confirmation and explicit environment opt-in to delete.',
      );
      return;
    }

    await client.query(
      `UPDATE users SET "defaultCompanyId" = NULL WHERE "defaultCompanyId" = $1`,
      [company.id],
    );
    await client.query(
      `UPDATE auth_sessions SET "activeCompanyId" = NULL WHERE "activeCompanyId" = $1`,
      [company.id],
    );
    await client.query(
      `UPDATE companies SET "parentCompanyId" = NULL WHERE "parentCompanyId" = $1`,
      [company.id],
    );

    await deleteByIds(client, schema, 'companies', [company.id]);

    const stillThere = await client.query(
      `SELECT id FROM companies WHERE id = $1`,
      [company.id],
    );
    if ((stillThere.rowCount ?? 0) > 0) {
      throw new Error('Company still exists after cascade delete');
    }

    await client.query('COMMIT');
    console.log(`SUCCESS: deleted company ${company.company_code}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('FAILED:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
