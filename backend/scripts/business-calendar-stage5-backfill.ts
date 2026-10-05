/**
 * Stage 5 — Business Calendar legacy backfill (dry-run by default).
 *
 * Usage:
 *   npx tsx scripts/business-calendar-stage5-backfill.ts \
 *     --expect-companies=1 --expect-branches=1 \
 *     --expect-working-days=7 --expect-holidays=1 \
 *     --effective-year=2026 \
 *     --company-id=<uuid> --actor-user-id=<uuid>
 *
 * Apply:
 *   ...same args... --apply
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { runBusinessCalendarBackfill } from '../src/modules/business-calendar/business-calendar-backfill.runner';
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

function requiredNumber(name: string): number {
  const value = arg(name);
  if (value == null || Number.isNaN(Number(value))) {
    throw new Error(`Missing or invalid --${name}=N`);
  }
  return Number(value);
}

async function main() {
  const apply = flag('apply');
  const writeTarget = apply
    ? assertQaWriteEnvironment('migration:calendar:backfill')
    : undefined;
  const allowProduction = flag('allow-production');
  const companyId = arg('company-id');
  const actorUserId = arg('actor-user-id');
  const reportPath =
    arg('report') ??
    resolve(
      process.cwd(),
      `../docs/product/business-calendar-stage-5-backfill-report${apply ? '-applied' : '-dry-run'}.json`,
    );

  if (!actorUserId) {
    throw new Error('--actor-user-id=<uuid> is required');
  }

  const database = await createPrismaClient();
  const { prisma } = database;
  try {
    const runtimeTarget = await readRuntimeDatabaseIdentity(
      prisma,
      'migration:calendar:backfill',
    );
    if (writeTarget) {
      await assertQaStagingSentinel(
        prisma,
        'migration:calendar:backfill',
        writeTarget,
      );
    }
    const databaseName = runtimeTarget.databaseName;
    const databaseSchema = runtimeTarget.databaseSchema ?? 'unknown';

    const report = await runBusinessCalendarBackfill(prisma, {
      apply,
      allowProduction,
      effectiveYear: requiredNumber('effective-year'),
      databaseName,
      databaseSchema,
      actorUserId,
      companyId,
      expected: {
        companies: requiredNumber('expect-companies'),
        branches: requiredNumber('expect-branches'),
        workingDays: requiredNumber('expect-working-days'),
        holidays: requiredNumber('expect-holidays'),
      },
    });

    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: report.dryRun,
          target: runtimeTarget,
          reportPath,
          applied: report.applied,
          flags: report.flags,
        },
        null,
        2,
      ),
    );
  } finally {
    await database.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
