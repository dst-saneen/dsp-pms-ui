/**
 * Section 8 — controlled Asset V2 backfill (dry-run by default).
 *
 * Usage:
 *   npx tsx scripts/asset-backfill.ts --mapping=prisma/asset-v2-mapping/mapping.json
 *   npx tsx scripts/asset-backfill.ts --mapping=... --card-import=... --apply
 *
 * Card plaintext belongs only in a local --card-import file, never in the mapping JSON.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';

import { validateEnvironment, type Environment } from '../src/config';
import { AssetSensitiveIdentifierService } from '../src/modules/asset-domain/asset-sensitive-identifier.service';
import { runAssetV2Backfill } from '../src/modules/asset-domain/migration/asset-v2-backfill.service';
import {
  loadAssetV2CardImportFile,
  loadAssetV2MappingFile,
} from '../src/modules/asset-domain/migration/asset-v2-mapping.loader';
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
    ? assertQaWriteEnvironment('migration:assets:backfill')
    : undefined;
  const mappingPath = arg('mapping');
  const cardImportPath = arg('card-import');
  const mapping = mappingPath
    ? loadAssetV2MappingFile(resolve(mappingPath))
    : undefined;
  const cardImport = cardImportPath
    ? loadAssetV2CardImportFile(resolve(cardImportPath))
    : undefined;
  const identifiers = cardImport
    ? new AssetSensitiveIdentifierService(
        new ConfigService<Environment, true>(validateEnvironment(process.env)),
      )
    : undefined;

  const { prisma, disconnect } = await createPrismaClient();
  try {
    const runtimeTarget = await readRuntimeDatabaseIdentity(
      prisma,
      'migration:assets:backfill',
    );
    if (writeTarget) {
      await assertQaStagingSentinel(
        prisma,
        'migration:assets:backfill',
        writeTarget,
      );
    }
    const report = await runAssetV2Backfill(prisma, {
      apply,
      mapping,
      cardImport,
      identifiers,
      databaseName: runtimeTarget.databaseName,
      databaseSchema: runtimeTarget.databaseSchema ?? 'unknown',
    });
    const reportPath =
      arg('report') ??
      resolve(
        process.cwd(),
        apply
          ? 'asset-v2-backfill-applied.json'
          : 'asset-v2-backfill-dry-run.json',
      );
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    const ok = report.fatal.length === 0 && report.exceptions.length === 0;
    console.log(
      JSON.stringify(
        {
          ok,
          dryRun: report.dryRun,
          target: runtimeTarget,
          reportPath,
          mappingChecksum: report.mappingChecksum,
          updatedCount: report.updatedCount,
          rejectedCount: report.rejectedCount,
          exceptionCount: report.exceptions.reduce(
            (sum, item) => sum + item.count,
            0,
          ),
          fatal: report.fatal,
        },
        null,
        2,
      ),
    );
    if (!ok) {
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
