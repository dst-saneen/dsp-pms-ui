import { PROJECT_LITE_INTEGRITY_CHECKS } from '../../src/modules/projects/migration/project-lite-integrity.queries';
import { runProjectLiteIntegrity } from '../../src/modules/projects/migration/project-lite-integrity.service';

describe('project-lite-integrity', () => {
  it('covers contract backstops from plan §3.8 / §9', () => {
    const codes = PROJECT_LITE_INTEGRITY_CHECKS.map((check) => check.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'NULL_TYPED_PROJECT_FIELDS',
        'MISSING_COMPANY_PROJECT_CODE_UNIQUE',
        'MISSING_ACTIVE_TEAM_PARTIAL_UNIQUE',
        'MISSING_PARENT_CYCLE_TRIGGER',
        'MISSING_DAILY_HOURS_TRIGGER',
        'MISSING_HISTORY_IMMUTABLE_TRIGGER',
        'INTERNAL_WITH_BUSINESS_PARTY',
      ]),
    );
  });

  it('reports missing contract objects as findings', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn((sql: string) => {
        if (sql.includes("indexname = 'projects_companyId_projectCode_key'")) {
          return Promise.resolve([{ id: 'missing' }]);
        }
        if (sql.includes('trg_project_task_parent_cycle_guard')) {
          return Promise.resolve([{ id: 'missing' }]);
        }
        return Promise.resolve([]);
      }),
    };

    const report = await runProjectLiteIntegrity(prisma, {
      databaseName: 'test',
      databaseSchema: 'public',
    });

    expect(report.exceptionCount).toBeGreaterThan(0);
    expect(report.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        'MISSING_COMPANY_PROJECT_CODE_UNIQUE',
        'MISSING_PARENT_CYCLE_TRIGGER',
      ]),
    );
  });
});
