/**
 * Section 8 — plan §14 integrity verifier. All queries must return zero rows.
 *
 * Usage:
 *   npx tsx scripts/asset-integrity.ts [--report=path]
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { runAssetV2Integrity } from '../src/modules/asset-domain/migration/asset-v2-integrity.service';
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
    const report = await runAssetV2Integrity(prisma, {
      databaseName: dbInfo[0]?.db ?? 'unknown',
      databaseSchema: process.env.DATABASE_SCHEMA ?? 'public',
    });
    const reportPath =
      arg('report') ?? resolve(process.cwd(), 'asset-v2-integrity-report.json');
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(
      JSON.stringify(
        {
          ok: report.exceptionCount === 0,
          exceptionCount: report.exceptionCount,
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
