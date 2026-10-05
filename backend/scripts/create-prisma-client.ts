import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function requireSafeDatabaseSchema(
  rawSchema: string | undefined,
): string {
  const schema = rawSchema?.trim();

  if (!schema) {
    throw new Error('DATABASE_SCHEMA is required.');
  }

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error('DATABASE_SCHEMA must be a valid PostgreSQL identifier.');
  }

  return schema;
}

export async function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const databaseSchema = requireSafeDatabaseSchema(process.env.DATABASE_SCHEMA);

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  const runtimeUrl = new URL(
    databaseUrl.replace(/^postgres(?:ql)?\+asyncpg:\/\//i, 'postgresql://'),
  );
  runtimeUrl.searchParams.delete('schema');

  const sslMode = process.env.DATABASE_SSL_MODE?.trim();
  const sslCaPath = process.env.DATABASE_SSL_CA?.trim();

  if (sslCaPath) {
    runtimeUrl.searchParams.delete('sslmode');
  } else if (sslMode) {
    runtimeUrl.searchParams.set('sslmode', sslMode);
  }

  const ssl = sslCaPath
    ? {
        ca: readFileSync(resolve(process.cwd(), sslCaPath), 'utf8'),
        rejectUnauthorized: true,
      }
    : undefined;

  const pool = new pg.Pool({
    connectionString: runtimeUrl.toString(),
    ssl,
    options: `-c search_path=${databaseSchema}`,
  });

  const adapter = new PrismaPg(pool, {
    schema: databaseSchema,
  });

  const prisma = new PrismaClient({ adapter });

  return {
    prisma,
    schema: databaseSchema,
    async disconnect() {
      await prisma.$disconnect();
      await pool.end();
    },
  };
}
