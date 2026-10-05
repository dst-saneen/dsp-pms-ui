import 'dotenv/config';

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { QA_STAGING_TARGET, requiredEnv } from '../assert-destructive-db-guard';

const DEFAULT_BASELINE = resolve(
  process.cwd(),
  '.qa-runs',
  'staging-baseline',
  'structure-source.sql',
);

function normalizedDump(value: string): string {
  return value
    .replace(/\r+\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => !/^\\(?:un)?restrict\s+/.test(line))
    .join('\n');
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

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

function main(): void {
  const executedAt = new Date().toISOString();
  const saveEvidence = process.argv.includes('--save-evidence');
  const baselinePath = resolve(
    process.cwd(),
    process.argv
      .find((argument) => argument.startsWith('--baseline='))
      ?.slice('--baseline='.length) ?? DEFAULT_BASELINE,
  );
  if (!existsSync(baselinePath)) {
    throw new Error(
      `Pre-operation structure baseline is missing: ${baselinePath}`,
    );
  }

  const runtimeUrl = new URL(
    requiredEnv('DATABASE_URL').replace(
      /^postgres(?:ql)?\+asyncpg:\/\//i,
      'postgresql://',
    ),
  );
  const databaseName = decodeURIComponent(
    runtimeUrl.pathname.replace(/^\//, ''),
  );
  const databaseUser = decodeURIComponent(runtimeUrl.username);
  if (
    databaseName.toLowerCase() !== QA_STAGING_TARGET.databaseName ||
    databaseUser.toLowerCase() !== QA_STAGING_TARGET.databaseUser
  ) {
    throw new Error(
      'DATABASE_URL does not point to the approved database and database user.',
    );
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
      `--schema=${QA_STAGING_TARGET.currentSchema}`,
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

  const baseline = normalizedDump(readFileSync(baselinePath, 'utf8'));
  const current = normalizedDump(result.stdout);
  const baselineSha256 = sha256(baseline);
  const currentSha256 = sha256(current);
  const unchanged = baseline === current;
  const baselineLines = baseline.split('\n');
  const currentLines = current.split('\n');
  const comparisonLength = Math.max(baselineLines.length, currentLines.length);
  let firstDifferenceIndex = -1;
  for (let index = 0; index < comparisonLength; index += 1) {
    if (baselineLines[index] !== currentLines[index]) {
      firstDifferenceIndex = index;
      break;
    }
  }

  const evidencePath = saveEvidence
    ? resolve(
        process.cwd(),
        '.qa-runs',
        `current-structure-verification-${Date.now()}.json`,
      )
    : null;
  const evidence = {
    executedAt,
    mode: 'READ_ONLY_STRUCTURE_COMPARISON',
    status: unchanged ? 'CURRENT_SCHEMA_UNCHANGED' : 'CURRENT_SCHEMA_DRIFTED',
    databaseName,
    databaseUser,
    schema: QA_STAGING_TARGET.currentSchema,
    baselinePath,
    baselineSha256,
    currentSha256,
    unchanged,
    comparison: {
      baselineLineCount: baselineLines.length,
      currentLineCount: currentLines.length,
      firstDifferenceLine:
        firstDifferenceIndex === -1 ? null : firstDifferenceIndex + 1,
      baselineLine:
        firstDifferenceIndex === -1
          ? null
          : (baselineLines[firstDifferenceIndex] ?? null),
      currentLine:
        firstDifferenceIndex === -1
          ? null
          : (currentLines[firstDifferenceIndex] ?? null),
    },
    evidencePath,
    note: 'Only pg_dump random \\restrict and \\unrestrict guard lines are excluded from the comparison.',
  };
  if (evidencePath) {
    mkdirSync(resolve(process.cwd(), '.qa-runs'), { recursive: true });
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
  }
  console.log(JSON.stringify(evidence, null, 2));

  if (!unchanged) {
    process.exitCode = 2;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
