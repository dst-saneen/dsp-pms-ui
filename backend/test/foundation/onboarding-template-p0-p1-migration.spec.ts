import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Onboarding Template P0/P1 hardening migration', () => {
  const migration = readFileSync(
    resolve(
      __dirname,
      '../../prisma/migrations/20260819130000_onboarding_template_p0_p1_hardening/migration.sql',
    ),
    'utf8',
  );

  it('adds tenant-qualified Template and designation-assignment foreign keys', () => {
    expect(migration).toContain(
      '"OnboardingTemplateVersion_company_template_fkey"',
    );
    expect(migration).toContain(
      '"designation_onboarding_assignments_company_designation_fkey"',
    );
    expect(migration).toContain(
      '"designation_onboarding_assignments_company_branch_fkey"',
    );
    expect(migration).toContain(
      '"designation_onboarding_assignments_company_template_fkey"',
    );
  });

  it('serializes assignment overlap and every draft-child mutation', () => {
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('BEFORE INSERT OR UPDATE OR DELETE');
    expect(migration).toMatch(
      /FROM "OnboardingTemplateVersion"\s+WHERE id = version_id\s+FOR UPDATE;/,
    );
  });

  it('guards task shape, dependency containment, and Asset results', () => {
    expect(migration).toContain('onboarding_template_task_shape_guard');
    expect(migration).toContain(
      'prerequisite."onboardingTemplateVersionId" = NEW.id',
    );
    expect(migration).toContain(
      '"EmployeeOnboardingTask_asset_result_shape_check"',
    );
    expect(migration).toMatch(
      /"workType" = 'ASSET'[\s\S]+COALESCE\("statusV2"::text, status::text\) = 'COMPLETED'/,
    );
  });
});
