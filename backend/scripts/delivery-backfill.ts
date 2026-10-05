/**
 * Gate P0.3 — Delivery V2 backfill (dry-run by default).
 *
 * Usage:
 *   npx tsx scripts/delivery-backfill.ts
 *   npx tsx scripts/delivery-backfill.ts --apply
 *
 * Encryption uses the same env keys as runtime boot validation when present.
 * Plaintext columns are NOT nulled here; that happens only after cutover/verify.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { runDeliveryV2Backfill } from '../src/modules/delivery/migration';
import { parseDeliveryVersionedKeys } from '../src/config/delivery-security-env';
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

function decodeActiveKey(
  rawJson: string | undefined,
  activeVersion: string | undefined,
  envName: string,
): { key?: Buffer; version: string } {
  const version = activeVersion?.trim() || 'v1';
  try {
    const keys = parseDeliveryVersionedKeys(rawJson, envName);
    return { key: keys[version], version };
  } catch {
    return { version };
  }
}

async function main() {
  const apply = flag('apply');
  const writeTarget = apply
    ? assertQaWriteEnvironment('migration:delivery:backfill')
    : undefined;
  const { prisma, disconnect } = await createPrismaClient();
  try {
    const content = decodeActiveKey(
      process.env.DELIVERY_CONTENT_ENCRYPTION_KEYS_JSON,
      process.env.DELIVERY_CONTENT_ENCRYPTION_ACTIVE_VERSION,
      'DELIVERY_CONTENT_ENCRYPTION_KEYS_JSON',
    );
    const address = decodeActiveKey(
      process.env.DELIVERY_ADDRESS_HMAC_KEYS_JSON,
      process.env.DELIVERY_ADDRESS_HMAC_ACTIVE_VERSION,
      'DELIVERY_ADDRESS_HMAC_KEYS_JSON',
    );

    const runtimeTarget = await readRuntimeDatabaseIdentity(
      prisma,
      'migration:delivery:backfill',
    );
    if (writeTarget) {
      await assertQaStagingSentinel(
        prisma,
        'migration:delivery:backfill',
        writeTarget,
      );
    }

    const report = await runDeliveryV2Backfill(
      prisma,
      {
        databaseName: runtimeTarget.databaseName,
        databaseSchema: runtimeTarget.databaseSchema ?? 'unknown',
      },
      {
        apply,
        contentEncryptionKey: content.key,
        contentKeyVersion: content.version,
        addressHmacKey: address.key,
        addressHmacKeyVersion: address.version,
        workerLeaseSeconds: Number(
          process.env.DELIVERY_WORKER_LEASE_SECONDS ?? 300,
        ),
      },
    );

    const reportPath =
      arg('report') ??
      resolve(process.cwd(), 'delivery-v2-backfill-report.json');
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(
      JSON.stringify(
        {
          dryRun: report.dryRun,
          target: runtimeTarget,
          blocked: report.blocked,
          updates: report.updates,
          exceptionCount: report.preflight.exceptionCount,
          blockingExceptionCount: report.preflight.blockingExceptionCount,
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
