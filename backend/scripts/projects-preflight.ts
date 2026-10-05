/**
 * Project Lite Phase 1 — read-only preflight report (IDs only, no PII).
 *
 * Usage:
 *   npx tsx scripts/projects-preflight.ts [--report=path] [--format=json|csv]
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  projectLitePreflightToCsv,
  runProjectLitePreflight,
} from '../src/modules/projects/migration';
import { createPrismaClient } from './create-prisma-client';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const format = arg('format') === 'csv' ? 'csv' : 'json';
  const { prisma, disconnect } = await createPrismaClient();
  try {
    const dbInfo = await prisma.$queryRawUnsafe<Array<{ db: string }>>(
      'SELECT current_database() AS db',
    );
    const report = await runProjectLitePreflight(prisma, {
      databaseName: dbInfo[0]?.db ?? 'unknown',
      databaseSchema: process.env.DATABASE_SCHEMA ?? 'public',
    });
    const body =
      format === 'csv'
        ? projectLitePreflightToCsv(report)
        : `${JSON.stringify(report, null, 2)}\n`;
    const reportPath =
      arg('report') ??
      resolve(
        process.cwd(),
        format === 'csv'
          ? 'project-lite-preflight-report.csv'
          : 'project-lite-preflight-report.json',
      );
    writeFileSync(reportPath, body, 'utf8');
    console.log(
      JSON.stringify(
        {
          ok: report.blockingExceptionCount === 0,
          exceptionCount: report.exceptionCount,
          blockingExceptionCount: report.blockingExceptionCount,
          businessPartyAvailable: report.businessPartyAvailable,
          reportPath,
        },
        null,
        2,
      ),
    );
    if (report.blockingExceptionCount > 0) {
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
