import { PROJECT_LITE_PREFLIGHT_CHECKS } from '../../src/modules/projects/migration/project-lite-preflight.queries';
import {
  projectLitePreflightToCsv,
  runProjectLitePreflight,
  type ProjectLiteQueryClient,
} from '../../src/modules/projects/migration/project-lite-preflight.service';

describe('Project Lite Phase 1 preflight', () => {
  it('registers the plan §9 exception codes', () => {
    const codes = PROJECT_LITE_PREFLIGHT_CHECKS.map((check) => check.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'DUPLICATE_COMPANY_PROJECT_CODE',
        'UNKNOWN_PROJECT_STATUS',
        'PARENT_SELF_LINK',
        'TASK_SUBMISSION_LOCAL_FILE_PATH',
        'CLIENT_STRINGS_UNMAPPED',
        'DAILY_HOURS_EXCEEDED',
      ]),
    );
    expect(
      PROJECT_LITE_PREFLIGHT_CHECKS.every((check) =>
        check.sql.toUpperCase().includes('LIMIT'),
      ),
    ).toBe(true);
  });

  it('aggregates findings and business-party availability', async () => {
    const prisma: ProjectLiteQueryClient = {
      $queryRawUnsafe: jest.fn((sql: string) => {
        if (sql.includes('pg_catalog.pg_class')) {
          return Promise.resolve([]);
        }
        if (sql.includes('COUNT(*)')) {
          if (sql.includes('PROPOSAL')) {
            return Promise.resolve([{ count: 1n }]);
          }
          if (sql.includes('filePath')) {
            return Promise.resolve([{ count: 2n }]);
          }
          return Promise.resolve([{ count: 0n }]);
        }
        if (sql.includes('NOT IN') && sql.includes("'PROPOSAL'")) {
          return Promise.resolve([{ id: 'proj-bad-status' }]);
        }
        if (sql.includes('task_submissions') && sql.includes('filePath')) {
          return Promise.resolve([{ id: 'sub-1' }, { id: 'sub-2' }]);
        }
        return Promise.resolve([]);
      }),
    };

    const report = await runProjectLitePreflight(prisma, {
      databaseName: 'test',
      databaseSchema: 'public',
    });

    expect(report.businessPartyAvailable).toBe(false);
    expect(
      report.findings.some((f) => f.code === 'UNKNOWN_PROJECT_STATUS'),
    ).toBe(true);
    const submissionFinding = report.findings.find(
      (f) => f.code === 'TASK_SUBMISSION_LOCAL_FILE_PATH',
    );
    expect(submissionFinding?.count).toBe(2);
    expect(submissionFinding?.sampleIds).toEqual(['sub-1', 'sub-2']);
    expect(submissionFinding?.blocking).toBe(true);
    expect(report.blockingExceptionCount).toBeGreaterThan(0);

    const csv = projectLitePreflightToCsv(report);
    expect(csv).toContain('UNKNOWN_PROJECT_STATUS,true,proj-bad-status');
    expect(csv).toContain('TASK_SUBMISSION_LOCAL_FILE_PATH,true,sub-1');
  });
});
