#!/usr/bin/env node
/**
 * Disposable migration rehearsal for recruitment foundation migrations.
 * Usage: node scripts/recruitment-disposable-validate.mjs [preflight|apply]
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const mode = process.argv[2] ?? 'preflight';
const backendRoot = resolve(process.cwd());
const migrationDir = resolve(
  backendRoot,
  'prisma/migrations/20260814100000_recruitment_foundation',
);
const backfillDir = resolve(
  backendRoot,
  'prisma/migrations/20260814110000_recruitment_backfill',
);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: backendRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (mode === 'preflight') {
  if (!existsSync(resolve(migrationDir, 'migration.sql'))) {
    console.error('Recruitment foundation migration is missing.');
    process.exit(1);
  }

  if (!existsSync(resolve(backfillDir, 'migration.sql'))) {
    console.error('Recruitment backfill migration is missing.');
    process.exit(1);
  }

  run('npx', ['prisma', 'validate']);
  console.log('Recruitment migration preflight passed.');
  process.exit(0);
}

if (mode === 'apply') {
  run('npx', ['prisma', 'migrate', 'deploy']);
  console.log('Recruitment migrations applied.');
  process.exit(0);
}

console.error('Usage: node scripts/recruitment-disposable-validate.mjs [preflight|apply]');
process.exit(1);
