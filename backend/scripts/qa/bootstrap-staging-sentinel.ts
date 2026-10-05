import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Pool } from 'pg';

import {
  assertQaWriteEnvironment,
  QA_STAGING_TARGET,
  requiredEnv,
} from '../assert-destructive-db-guard';

type RuntimeTarget = {
  databaseName: string;
  databaseSchema: string | null;
  databaseUser: string;
};

async function main(): Promise<void> {
  if (!process.argv.includes('--apply')) {
    console.log(
      JSON.stringify(
        {
          mode: 'PLAN_ONLY',
          target: QA_STAGING_TARGET,
          note: 'No database connection was opened. A DBA must first create dsp_pms_stg from the verified structure-only baseline.',
        },
        null,
        2,
      ),
    );
    return;
  }

  const target = assertQaWriteEnvironment('bootstrap-staging-sentinel');
  if (
    requiredEnv('QA_STAGING_SENTINEL_BOOTSTRAP_TOKEN') !==
    QA_STAGING_TARGET.bootstrapToken
  ) {
    throw new Error(
      'QA_STAGING_SENTINEL_BOOTSTRAP_TOKEN does not match the target.',
    );
  }

  const runtimeUrl = new URL(
    requiredEnv('DATABASE_URL').replace(
      /^postgres(?:ql)?\+asyncpg:\/\//i,
      'postgresql://',
    ),
  );
  runtimeUrl.searchParams.delete('schema');
  const sslCaPath = process.env.DATABASE_SSL_CA?.trim();
  const pool = new Pool({
    connectionString: runtimeUrl.toString(),
    ssl: sslCaPath
      ? {
          ca: readFileSync(resolve(process.cwd(), sslCaPath), 'utf8'),
          rejectUnauthorized: true,
        }
      : undefined,
    options: `-c search_path=${target.databaseSchema}`,
  });

  const client = await pool.connect();
  try {
    const result = await client.query<RuntimeTarget>(
      `SELECT current_database() AS "databaseName",
              current_schema() AS "databaseSchema",
              current_user AS "databaseUser"`,
    );
    const runtime = result.rows[0];
    if (
      !runtime ||
      runtime.databaseName.toLowerCase() !== target.databaseName ||
      runtime.databaseUser.toLowerCase() !== target.databaseUser ||
      runtime.databaseSchema?.toLowerCase() !== target.databaseSchema
    ) {
      throw new Error(
        'Connected target did not match the approved staging target.',
      );
    }

    await client.query('BEGIN');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS qa_environment_sentinel (
          sentinel_key TEXT PRIMARY KEY,
          database_name TEXT NOT NULL,
          schema_name TEXT NOT NULL,
          enabled BOOLEAN NOT NULL DEFAULT TRUE,
          note TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT qa_environment_sentinel_exact_target CHECK (
            database_name = 'dsp_erp_dev' AND schema_name = 'dsp_pms_stg'
          )
        )
      `);
      await client.query(
        `INSERT INTO qa_environment_sentinel (
           sentinel_key, database_name, schema_name, enabled, note
         ) VALUES ($1, $2, $3, TRUE, $4)
         ON CONFLICT (sentinel_key) DO UPDATE SET
           database_name = EXCLUDED.database_name,
           schema_name = EXCLUDED.schema_name,
           enabled = TRUE,
           note = EXCLUDED.note,
           updated_at = NOW()`,
        [
          target.sentinelKey,
          target.databaseName,
          target.databaseSchema,
          'Synthetic DSP ERP staging schema. QA writers only; never current data.',
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    console.log('Staging sentinel is present and enabled on the exact target.');
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
