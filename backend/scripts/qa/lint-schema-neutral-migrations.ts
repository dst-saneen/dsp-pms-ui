import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

import {
  findSchemaNeutralityViolations,
  IMMUTABLE_LEGACY_SCHEMA_QUALIFIED_MIGRATIONS,
  sha256,
} from './schema-neutral-sql';

function migrationFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return migrationFiles(path);
    }
    return entry.isFile() && entry.name === 'migration.sql' ? [path] : [];
  });
}

function main(): void {
  const backendRoot = process.cwd();
  const files = migrationFiles(
    resolve(backendRoot, 'prisma', 'migrations'),
  ).sort();
  const failures: string[] = [];
  const immutableLegacy: string[] = [];
  const filesByPath = new Map(
    files.map((file) => [
      relative(backendRoot, file).split(sep).join('/'),
      file,
    ]),
  );
  const verifiedImmutablePaths = new Set<string>();

  for (const [path, expectedHash] of Object.entries(
    IMMUTABLE_LEGACY_SCHEMA_QUALIFIED_MIGRATIONS,
  )) {
    const file = filesByPath.get(path);
    if (!file) {
      failures.push(`${path}: immutable legacy migration is missing`);
      continue;
    }
    const actualHash = sha256(readFileSync(file, 'utf8'));
    if (actualHash !== expectedHash) {
      failures.push(`${path}: immutable legacy migration hash changed`);
      continue;
    }
    immutableLegacy.push(path);
    verifiedImmutablePaths.add(path);
  }

  for (const file of files) {
    const path = relative(backendRoot, file).split(sep).join('/');
    if (verifiedImmutablePaths.has(path)) {
      continue;
    }
    const content = readFileSync(file, 'utf8');
    const violations = findSchemaNeutralityViolations(content);
    if (violations.length === 0) {
      continue;
    }

    failures.push(`${path}: ${violations.join(', ')}`);
  }

  if (failures.length > 0) {
    throw new Error(
      `Schema-dependent or dynamically executed migration SQL is forbidden. Use unqualified static SQL with the configured search_path.\n${failures.join('\n')}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        status: 'PASS',
        checkedMigrations: files.length,
        immutableLegacyMigrations: immutableLegacy,
        note: 'Legacy files are hash-pinned and must not be replayed into dsp_pms_stg; validate the full historical chain only in disposable CI PostgreSQL.',
      },
      null,
      2,
    ),
  );
}

main();
