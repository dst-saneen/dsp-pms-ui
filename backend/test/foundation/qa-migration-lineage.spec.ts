import { createHash } from 'node:crypto';

import {
  compareMigrationLineage,
  migrationChecksumVariants,
  RepositoryMigration,
} from '../../scripts/qa/migration-lineage';

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

describe('QA migration lineage', () => {
  const repositoryMigration = (
    name: string,
    content: string,
  ): RepositoryMigration => ({
    name,
    checksums: migrationChecksumVariants(Buffer.from(content, 'utf8')),
  });

  it('accepts exact, LF and CRLF representations of identical SQL', () => {
    const repository = [
      repositoryMigration('001_exact', 'SELECT 1;\n'),
      repositoryMigration('002_lf', 'SELECT 2;\r\n'),
      repositoryMigration('003_crlf', 'SELECT 3;\n'),
    ];
    const result = compareMigrationLineage(repository, [
      {
        migrationName: '001_exact',
        checksum: repository[0].checksums.exact,
      },
      {
        migrationName: '002_lf',
        checksum: repository[1].checksums.lf,
      },
      {
        migrationName: '003_crlf',
        checksum: repository[2].checksums.crlf,
      },
    ]);

    expect(result.ready).toBe(true);
    expect(result.checksumMatchModes).toEqual({ exact: 1, lf: 1, crlf: 1 });
    expect(result.checksumMismatches).toEqual([]);
  });

  it('blocks content changes even when migration counts match', () => {
    const repository = [repositoryMigration('001_changed', 'SELECT 1;\n')];
    const result = compareMigrationLineage(repository, [
      {
        migrationName: '001_changed',
        checksum: sha256('SELECT 2;\n'),
      },
    ]);

    expect(result.ready).toBe(false);
    expect(result.checksumMismatches).toHaveLength(1);
    expect(result.missingMigrations).toEqual([]);
    expect(result.unexpectedMigrations).toEqual([]);
  });

  it('blocks missing, unexpected and duplicate applied migrations', () => {
    const repository = [
      repositoryMigration('001_expected', 'SELECT 1;\n'),
      repositoryMigration('002_missing', 'SELECT 2;\n'),
    ];
    const exact = repository[0].checksums.exact;
    const result = compareMigrationLineage(repository, [
      { migrationName: '001_expected', checksum: exact },
      { migrationName: '001_expected', checksum: exact },
      { migrationName: '999_unexpected', checksum: exact },
    ]);

    expect(result.ready).toBe(false);
    expect(result.missingMigrations).toEqual(['002_missing']);
    expect(result.unexpectedMigrations).toEqual(['999_unexpected']);
    expect(result.duplicateAppliedMigrations).toEqual(['001_expected']);
  });
});
