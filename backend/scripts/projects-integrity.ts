/**
 * Project Lite Phase 3 — post-contract integrity verifier.
 * All checks must return zero rows.
 *
 * Usage:
 *   pnpm run migration:projects:integrity
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { runProjectLiteIntegrity } from '../src/modules/projects/migration';
import { createPrismaClient } from './create-prisma-client';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const { prisma, disconnect } = await createPrismaClient();
  try {
    const dbInfo = await prisma.$queryRawUnsafe<Array<{ db: string }>>(
      'SELECT current_database() AS db',
    );
    const report = await runProjectLiteIntegrity(prisma, {
      databaseName: dbInfo[0]?.db ?? 'unknown',
      databaseSchema: process.env.DATABASE_SCHEMA ?? 'public',
    });
    const reportPath =
      arg('report') ??
      resolve(process.cwd(), 'project-lite-integrity-report.json');
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(
      JSON.stringify(
        {
          ok: report.exceptionCount === 0,
          exceptionCount: report.exceptionCount,
          findings: report.findings.map((finding) => finding.code),
          reportPath,
        },
        null,
        2,
      ),
    );
    if (report.exceptionCount > 0) {
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
