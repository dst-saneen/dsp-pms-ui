/**
 * Section 8 — read-only Asset V2 preflight report (IDs only, no PII).
 *
 * Usage:
 *   npx tsx scripts/asset-preflight.ts [--report=path] [--format=json|csv]
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  preflightToCsv,
  runAssetV2Preflight,
} from '../src/modules/asset-domain/migration/asset-v2-preflight.service';
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
    const report = await runAssetV2Preflight(prisma, {
      databaseName: dbInfo[0]?.db ?? 'unknown',
      databaseSchema: process.env.DATABASE_SCHEMA ?? 'public',
    });
    const body =
      format === 'csv'
        ? preflightToCsv(report)
        : `${JSON.stringify(report, null, 2)}\n`;
    const reportPath =
      arg('report') ??
      resolve(
        process.cwd(),
        format === 'csv'
          ? 'asset-v2-preflight-report.csv'
          : 'asset-v2-preflight-report.json',
      );
    writeFileSync(reportPath, body, 'utf8');
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
