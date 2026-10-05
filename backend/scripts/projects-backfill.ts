/**
 * Project Lite Phase 2 — deterministic backfill (dry-run by default).
 *
 * Usage:
 *   pnpm run migration:projects:backfill
 *   pnpm run migration:projects:backfill -- --apply
 *   pnpm run migration:projects:backfill -- --apply --mapping=prisma/project-lite-mapping/mapping.json
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { runProjectLiteBackfill } from '../src/modules/projects/migration';
import {
  assertQaStagingSentinel,
  assertQaWriteEnvironment,
  readRuntimeDatabaseIdentity,
} from './assert-destructive-db-guard';
import { createPrismaClient } from './create-prisma-client';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const apply = flag('apply');
  const writeTarget = apply
    ? assertQaWriteEnvironment('migration:projects:backfill')
    : undefined;
  const mappingPath = arg('mapping');
  const { prisma, disconnect } = await createPrismaClient();
  try {
    const runtimeTarget = await readRuntimeDatabaseIdentity(
      prisma,
      'migration:projects:backfill',
    );
    if (writeTarget) {
      await assertQaStagingSentinel(
        prisma,
        'migration:projects:backfill',
        writeTarget,
      );
    }
    const report = await runProjectLiteBackfill(
      prisma,
      {
        databaseName: runtimeTarget.databaseName,
        databaseSchema: runtimeTarget.databaseSchema ?? 'unknown',
      },
      { apply, mappingPath },
    );

    const reportPath =
      arg('report') ??
      resolve(process.cwd(), 'project-lite-backfill-report.json');
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(
      JSON.stringify(
        {
          ok: !report.blocked,
          dryRun: report.dryRun,
          target: runtimeTarget,
          blocked: report.blocked,
          updates: report.updates,
          notes: report.notes,
          reportPath,
        },
        null,
        2,
      ),
    );
    if (report.blocked) {
      process.exitCode = 1;
    }
  } finally {
    await disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
