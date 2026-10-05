import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export type RepositoryMigration = {
  checksums: {
    crlf: string;
    exact: string;
    lf: string;
  };
  name: string;
};

export type AppliedMigration = {
  checksum: string;
  migrationName: string;
};

export type MigrationLineageComparison = {
  checksumMatchModes: {
    crlf: number;
    exact: number;
    lf: number;
  };
  checksumMismatches: Array<{
    databaseChecksum: string;
    migrationName: string;
    repositoryChecksums: RepositoryMigration['checksums'];
  }>;
  duplicateAppliedMigrations: string[];
  missingMigrations: string[];
  ready: boolean;
  repositoryMigrationCount: number;
  uniqueAppliedMigrationCount: number;
  unexpectedMigrations: string[];
};

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function migrationChecksumVariants(
  content: Buffer,
): RepositoryMigration['checksums'] {
  const text = content.toString('utf8');
  const lfText = text.replace(/\r\n|\r/g, '\n');
  return {
    exact: sha256(content),
    lf: sha256(Buffer.from(lfText, 'utf8')),
    crlf: sha256(Buffer.from(lfText.replace(/\n/g, '\r\n'), 'utf8')),
  };
}

export function readRepositoryMigrations(
  migrationDirectory: string,
): RepositoryMigration[] {
  return readdirSync(migrationDirectory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(resolve(migrationDirectory, entry.name, 'migration.sql')),
    )
    .map((entry) => ({
      name: entry.name,
      checksums: migrationChecksumVariants(
        readFileSync(resolve(migrationDirectory, entry.name, 'migration.sql')),
      ),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function compareMigrationLineage(
  repositoryMigrations: RepositoryMigration[],
  appliedMigrations: AppliedMigration[],
): MigrationLineageComparison {
  const repositoryByName = new Map(
    repositoryMigrations.map((migration) => [migration.name, migration]),
  );
  const appliedByName = new Map<string, AppliedMigration[]>();
  for (const migration of appliedMigrations) {
    const rows = appliedByName.get(migration.migrationName) ?? [];
    rows.push(migration);
    appliedByName.set(migration.migrationName, rows);
  }

  const duplicateAppliedMigrations = [...appliedByName.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([name]) => name)
    .sort();
  const missingMigrations = repositoryMigrations
    .filter((migration) => !appliedByName.has(migration.name))
    .map((migration) => migration.name);
  const unexpectedMigrations = [...appliedByName.keys()]
    .filter((name) => !repositoryByName.has(name))
    .sort();
  const checksumMismatches: MigrationLineageComparison['checksumMismatches'] =
    [];
  const checksumMatchModes = { exact: 0, lf: 0, crlf: 0 };

  for (const repositoryMigration of repositoryMigrations) {
    const applied = appliedByName.get(repositoryMigration.name)?.[0];
    if (!applied) {
      continue;
    }
    const { checksums } = repositoryMigration;
    if (applied.checksum === checksums.exact) {
      checksumMatchModes.exact += 1;
    } else if (applied.checksum === checksums.lf) {
      checksumMatchModes.lf += 1;
    } else if (applied.checksum === checksums.crlf) {
      checksumMatchModes.crlf += 1;
    } else {
      checksumMismatches.push({
        migrationName: repositoryMigration.name,
        databaseChecksum: applied.checksum,
        repositoryChecksums: checksums,
      });
    }
  }

  return {
    repositoryMigrationCount: repositoryMigrations.length,
    uniqueAppliedMigrationCount: appliedByName.size,
    checksumMatchModes,
    missingMigrations,
    unexpectedMigrations,
    duplicateAppliedMigrations,
    checksumMismatches,
    ready:
      missingMigrations.length === 0 &&
      unexpectedMigrations.length === 0 &&
      duplicateAppliedMigrations.length === 0 &&
      checksumMismatches.length === 0,
  };
}
