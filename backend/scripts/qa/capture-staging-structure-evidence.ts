import 'dotenv/config';

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { QA_STAGING_TARGET, requiredEnv } from '../assert-destructive-db-guard';

function resolvePgDump(): string {
  const configured = process.env.PG_DUMP_BIN?.trim();
  if (configured) {
    return configured;
  }
  const windowsDefault = 'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe';
  return process.platform === 'win32' && existsSync(windowsDefault)
    ? windowsDefault
    : 'pg_dump';
}

function canonicalDump(value: string): string {
  return value
    .replace(/\r+\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => !/^\\(?:un)?restrict\s+/.test(line))
    .join('\n');
}

function main(): void {
  const databaseName = requiredEnv('DATABASE_NAME').toLowerCase();
  const databaseUser = requiredEnv('DATABASE_USER').toLowerCase();
  const databaseSchema = requiredEnv('DATABASE_SCHEMA').toLowerCase();
  if (
    databaseName !== QA_STAGING_TARGET.databaseName ||
    databaseUser !== QA_STAGING_TARGET.databaseUser ||
    databaseSchema !== QA_STAGING_TARGET.databaseSchema
  ) {
    throw new Error(
      'Staging structure evidence requires the exact dsp_erp_dev/dscape/dsp_pms_stg target.',
    );
  }

  const runtimeUrl = new URL(
    requiredEnv('DATABASE_URL').replace(
      /^postgres(?:ql)?\+asyncpg:\/\//i,
      'postgresql://',
    ),
  );
  const urlDatabase = decodeURIComponent(
    runtimeUrl.pathname.replace(/^\//, ''),
  );
  const urlUser = decodeURIComponent(runtimeUrl.username);
  const urlSchema = runtimeUrl.searchParams.get('schema')?.trim();
  if (
    urlDatabase.toLowerCase() !== databaseName ||
    urlUser.toLowerCase() !== databaseUser ||
    (urlSchema && urlSchema.toLowerCase() !== databaseSchema)
  ) {
    throw new Error('DATABASE_URL does not match the approved staging target.');
  }

  const pgEnvironment: NodeJS.ProcessEnv = {
    ...process.env,
    PGHOST: runtimeUrl.hostname,
    PGPORT: runtimeUrl.port || '5432',
    PGDATABASE: databaseName,
    PGUSER: databaseUser,
    PGPASSWORD: decodeURIComponent(runtimeUrl.password),
    PGCLIENTENCODING: 'UTF8',
  };
  const sslCaPath = process.env.DATABASE_SSL_CA?.trim();
  if (sslCaPath) {
    pgEnvironment.PGSSLMODE = 'verify-full';
    pgEnvironment.PGSSLROOTCERT = resolve(process.cwd(), sslCaPath);
  } else if (runtimeUrl.searchParams.get('sslmode')) {
    pgEnvironment.PGSSLMODE =
      runtimeUrl.searchParams.get('sslmode') ?? undefined;
  }

  const result = spawnSync(
    resolvePgDump(),
    [
      '--format=plain',
      '--schema-only',
      `--schema=${QA_STAGING_TARGET.databaseSchema}`,
      '--strict-names',
      '--no-owner',
      '--no-privileges',
      '--quote-all-identifiers',
      '--serializable-deferrable',
      '--lock-wait-timeout=10s',
    ],
    {
      env: pgEnvironment,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Read-only pg_dump failed with exit code ${String(result.status)}: ${result.stderr.trim()}`,
    );
  }

  const dump = canonicalDump(result.stdout);
  const sourceSchemaPattern = new RegExp(
    `(?<![A-Za-z0-9_])${QA_STAGING_TARGET.currentSchema}(?![A-Za-z0-9_])`,
    'i',
  );
  if (sourceSchemaPattern.test(dump)) {
    throw new Error('Final staging structure still references dsp_pms.');
  }
  const requiredMarkers = [
    'legal_country_code',
    'qa_environment_sentinel',
    '_prisma_migrations',
  ];
  const missingMarkers = requiredMarkers.filter(
    (marker) => !dump.includes(marker),
  );
  if (missingMarkers.length > 0) {
    throw new Error(
      `Final staging structure is missing: ${missingMarkers.join(', ')}.`,
    );
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDirectory = resolve(
    process.cwd(),
    '.qa-runs',
    'staging-baseline',
  );
  mkdirSync(outputDirectory, { recursive: true });
  const structurePath = resolve(
    outputDirectory,
    `structure-staging-final-${timestamp}.sql`,
  );
  writeFileSync(structurePath, dump, { encoding: 'utf8', flag: 'wx' });
  const evidence = {
    executedAt: new Date().toISOString(),
    mode: 'READ_ONLY_STRUCTURE_CAPTURE',
    status: 'STAGING_STRUCTURE_CAPTURED',
    target: { databaseName, databaseUser, databaseSchema },
    structurePath,
    byteLength: Buffer.byteLength(dump, 'utf8'),
    sha256: createHash('sha256').update(dump, 'utf8').digest('hex'),
    sourceSchemaReferences: 0,
    requiredMarkers,
  };
  const evidencePath = resolve(
    outputDirectory,
    `structure-staging-final-${timestamp}.json`,
  );
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  console.log(JSON.stringify({ ...evidence, evidencePath }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
