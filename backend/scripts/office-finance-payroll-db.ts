import 'dotenv/config';
import { Pool, type PoolClient } from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { requireSafeDatabaseSchema } from './create-prisma-client';

export function createOfficeFinancePayrollPool(): {
  pool: Pool;
  schema: string;
} {
  const databaseUrl = process.env.DATABASE_URL;
  const schema = requireSafeDatabaseSchema(process.env.DATABASE_SCHEMA);
  const sslCaPath = process.env.DATABASE_SSL_CA?.trim();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  const runtimeUrl = new URL(
    databaseUrl.replace(/^postgres(?:ql)?\+asyncpg:\/\//i, 'postgresql://'),
  );
  runtimeUrl.searchParams.delete('schema');
  runtimeUrl.searchParams.set('schema', schema);

  return {
    schema,
    pool: new Pool({
      connectionString: runtimeUrl.toString(),
      ssl: sslCaPath
        ? {
            ca: readFileSync(resolve(process.cwd(), sslCaPath), 'utf8'),
            rejectUnauthorized: true,
          }
        : undefined,
      options: `-c search_path=${schema}`,
    }),
  };
}

export async function withOfficeFinancePayrollClient<T>(
  run: (client: PoolClient, schema: string) => Promise<T>,
): Promise<T> {
  const { pool, schema } = createOfficeFinancePayrollPool();
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${schema}`);
    return await run(client, schema);
  } finally {
    client.release();
    await pool.end();
  }
}
