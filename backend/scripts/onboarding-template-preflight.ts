/**
 * Read-only Onboarding Template preflight report (IDs and finding codes only).
 *
 * Usage:
 *   npx tsx scripts/onboarding-template-preflight.ts [--report=path]
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  ONBOARDING_TEMPLATE_PREFLIGHT_PROBE_COLUMNS,
  preflightColumnKey,
  resolveOnboardingTemplatePreflightChecks,
} from '../src/modules/onboarding-template/migration/onboarding-template-preflight.queries';
import { createPrismaClient } from './create-prisma-client';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function loadColumnSet(
  prisma: Awaited<ReturnType<typeof createPrismaClient>>['prisma'],
  schema: string,
): Promise<Set<string>> {
  const tables = [
    ...new Set(
      ONBOARDING_TEMPLATE_PREFLIGHT_PROBE_COLUMNS.map((item) => item.table),
    ),
  ];
  const columns = [
    ...new Set(
      ONBOARDING_TEMPLATE_PREFLIGHT_PROBE_COLUMNS.map((item) => item.column),
    ),
  ];
  const rows = await prisma.$queryRawUnsafe<
    Array<{ table_name: string; column_name: string }>
  >(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = ANY($2::text[])
       AND column_name = ANY($3::text[])`,
    schema,
    tables,
    columns,
  );
  return new Set(
    rows.map((row) => preflightColumnKey(row.table_name, row.column_name)),
  );
}

async function main() {
  const { prisma, disconnect } = await createPrismaClient();
  try {
    const schema = process.env.DATABASE_SCHEMA ?? 'dsp_pms';
    const columns = await loadColumnSet(prisma, schema);
    const checks = resolveOnboardingTemplatePreflightChecks(columns);
    const findings: Array<{
      code: string;
      ids: string[];
      usedFallback: boolean;
    }> = [];
    const skipped: Array<{ code: string; reason: string }> = [];

    for (const check of checks) {
      if (check.skipped) {
        skipped.push({
          code: check.code,
          reason: check.skipReason ?? 'schema not ready',
        });
        continue;
      }
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        check.sql,
      );
      findings.push({
        code: check.code,
        ids: rows.map((row) => row.id),
        usedFallback: check.usedFallback,
      });
    }

    const exceptionCount = findings.reduce(
      (total, item) => total + item.ids.length,
      0,
    );
    const report = {
      generatedAt: new Date().toISOString(),
      exceptionCount,
      skipped,
      findings: findings.filter((item) => item.ids.length > 0),
    };
    const reportPath =
      arg('report') ??
      resolve(process.cwd(), 'onboarding-template-preflight-report.json');
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(
      JSON.stringify(
        {
          ok: exceptionCount === 0,
          exceptionCount,
          skippedCount: skipped.length,
          reportPath,
        },
        null,
        2,
      ),
    );
    if (exceptionCount > 0) {
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
