/**
 * Stage 10 — post-deploy schema + office readiness verification (read-only).
 *
 * Usage:
 *   npx tsx scripts/business-calendar-stage10-verify.ts \
 *     --company-id=<uuid> --branch-id=<uuid>
 *
 * Production-named DBs require --allow-production after backup evidence.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { runStage10Verify } from '../src/modules/business-calendar/business-calendar-stage10-verify.runner';
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
  const allowProduction = flag('allow-production');
  const companyId = arg('company-id');
  const branchId = arg('branch-id');
  const reportPath =
    arg('report') ??
    resolve(
      process.cwd(),
      '../docs/product/business-calendar-stage-10-verify-report.json',
    );

  const { prisma, disconnect } = await createPrismaClient();
  try {
    const dbInfo = await prisma.$queryRawUnsafe<Array<{ db: string }>>(
      'SELECT current_database() AS db',
    );
    const databaseName = dbInfo[0]?.db ?? 'unknown';
    const databaseSchema = process.env.DATABASE_SCHEMA ?? 'public';

    const report = await runStage10Verify(prisma as never, {
      databaseName,
      databaseSchema,
      companyId,
      branchId,
      allowProduction,
    });

    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(
      JSON.stringify(
        {
          ok: report.ok,
          reportPath,
          migrationPresent: report.migrationPresent,
          missingTables: report.missingTables,
          missingPermissionCodes: report.missingPermissionCodes,
          calendars: report.calendars,
          pilot: report.pilot?.office
            ? {
                scope: report.pilot.office.scope,
                runtimeMode: report.pilot.office.runtimeMode,
                readyForShadow: report.pilot.office.readyForShadow,
                blockers: report.pilot.office.blockers,
              }
            : null,
          notes: report.notes,
        },
        null,
        2,
      ),
    );
    if (!report.ok) process.exitCode = 1;
  } finally {
    await disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
