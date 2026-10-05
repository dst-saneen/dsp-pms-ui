/**
 * Stage 5 — Shadow parity compare for one office (branch).
 *
 * Usage:
 *   npx tsx scripts/business-calendar-stage5-shadow.ts \
 *     --company-id=<uuid> --branch-id=<uuid> --actor-user-id=<uuid>
 *
 * Optional:
 *   --allow-draft-versions   compare using Stage 5 backfill drafts if not published
 *   --activate-shadow        set LEGACY→SHADOW when unexplained mismatches are 0
 *   --report=<path>
 */
import { resolve } from 'node:path';

import { runBusinessCalendarShadowCompare } from '../src/modules/business-calendar/business-calendar-shadow.runner';
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
  const companyId = arg('company-id');
  const branchId = arg('branch-id');
  const actorUserId = arg('actor-user-id');
  const activateShadow = flag('activate-shadow');
  const writeTarget = activateShadow
    ? assertQaWriteEnvironment('migration:calendar:shadow')
    : undefined;
  if (!companyId || !branchId || !actorUserId) {
    throw new Error(
      '--company-id, --branch-id and --actor-user-id are required',
    );
  }

  const reportPath =
    arg('report') ??
    resolve(
      process.cwd(),
      '../docs/product/business-calendar-stage-5-shadow-parity.json',
    );

  const { prisma, disconnect } = await createPrismaClient();
  try {
    const runtimeTarget = await readRuntimeDatabaseIdentity(
      prisma,
      'migration:calendar:shadow',
    );
    if (writeTarget) {
      await assertQaStagingSentinel(
        prisma,
        'migration:calendar:shadow',
        writeTarget,
      );
    }
    const report = await runBusinessCalendarShadowCompare(prisma, {
      companyId,
      branchId,
      actorUserId,
      activateShadow,
      allowDraftVersions: flag('allow-draft-versions'),
      allowProduction: flag('allow-production'),
      databaseName: runtimeTarget.databaseName,
      databaseSchema: runtimeTarget.databaseSchema ?? 'unknown',
      reportPath,
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          target: runtimeTarget,
          reportPath,
          totals: report.totals,
          unexplainedCount: report.unexplainedCount,
          categories: report.categories,
          activatedShadow: report.activatedShadow,
          hasCompanyWorkingWeek: report.hasCompanyWorkingWeek,
          timezoneValid: report.timezoneValid,
        },
        null,
        2,
      ),
    );
  } finally {
    await disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
