import {
  ONBOARDING_TEMPLATE_PREFLIGHT_CHECKS,
  preflightColumnKey,
  resolveOnboardingTemplatePreflightChecks,
} from '../../src/modules/onboarding-template/migration/onboarding-template-preflight.queries';

describe('Onboarding template preflight queries', () => {
  it('covers duplicate published versions, containment, publish contract, and assignment overlap', () => {
    const codes = ONBOARDING_TEMPLATE_PREFLIGHT_CHECKS.map((item) => item.code);

    expect(codes).toEqual(
      expect.arrayContaining([
        'DUPLICATE_CURRENT_PUBLISHED',
        'VERSION_COMPANY_MISMATCH',
        'DEPARTMENT_SLICE_BRANCH_MISMATCH',
        'TASK_GROUP_CONTAINMENT_MISMATCH',
        'TEMPLATE_TASK_CONTAINMENT_MISMATCH',
        'DEPENDENCY_FOREIGN_VERSION',
        'PUBLISH_DEPENDENCY_CYCLE',
        'PUBLISH_SKIPPABLE_PREREQUISITE',
        'PUBLISH_GENERIC_AUTOMATION',
        'ASSIGNMENT_BRANCH_TEMPLATE_INCOMPATIBLE',
        'PUBLISH_NULL_OWNER',
        'PUBLISH_NAMED_ASSIGNMENT',
        'PUBLISH_ASSET_INVALID',
        'ASSIGNMENT_OVERLAP_DEFAULT',
        'ASSIGNMENT_OVERLAP_BRANCH',
      ]),
    );

    for (const check of ONBOARDING_TEMPLATE_PREFLIGHT_CHECKS) {
      expect(check.sql.toLowerCase()).toContain('select');
      expect(check.sql).not.toMatch(/\b(update|delete|insert)\b/i);
      if (check.fallbackSql) {
        expect(check.fallbackSql.toLowerCase()).toContain('select');
        expect(check.fallbackSql).not.toMatch(/\b(update|delete|insert)\b/i);
      }
    }
  });

  it('uses hierarchy fallbacks and skips snapshot-only checks before tenant columns exist', () => {
    const resolved = resolveOnboardingTemplatePreflightChecks(new Set());
    const byCode = Object.fromEntries(
      resolved.map((item) => [item.code, item]),
    );

    expect(byCode.DEPARTMENT_SLICE_BRANCH_MISMATCH.usedFallback).toBe(true);
    expect(byCode.DEPARTMENT_SLICE_BRANCH_MISMATCH.sql).toContain(
      'count(DISTINCT dep."branchId")',
    );
    expect(byCode.DEPENDENCY_FOREIGN_VERSION.usedFallback).toBe(true);
    expect(byCode.PUBLISH_NULL_OWNER.usedFallback).toBe(true);
    expect(byCode.PUBLISH_ASSET_INVALID.usedFallback).toBe(true);
    expect(byCode.PUBLISH_ASSET_INVALID.sql).toContain(
      'atype."companyId" = v."companyId"',
    );
    expect(byCode.TASK_GROUP_CONTAINMENT_MISMATCH.skipped).toBe(true);
    expect(byCode.TEMPLATE_TASK_CONTAINMENT_MISMATCH.skipped).toBe(true);
  });

  it('uses snapshot columns when they are present', () => {
    const columns = new Set([
      preflightColumnKey('OnboardingTemplateVersion', 'companyId'),
      preflightColumnKey('OnboardingDepartmentTemplate', 'companyId'),
      preflightColumnKey('OnboardingDepartmentTemplate', 'branchId'),
      preflightColumnKey('OnboardingTaskGroup', 'companyId'),
      preflightColumnKey('OnboardingTaskGroup', 'onboardingTemplateVersionId'),
      preflightColumnKey('OnboardingTemplateTask', 'companyId'),
      preflightColumnKey(
        'OnboardingTemplateTask',
        'onboardingTemplateVersionId',
      ),
      preflightColumnKey('designation_onboarding_assignments', 'companyId'),
      preflightColumnKey('designation_onboarding_assignments', 'deactivatedAt'),
      preflightColumnKey(
        'designation_onboarding_assignments',
        'deactivatedByUserId',
      ),
    ]);
    const resolved = resolveOnboardingTemplatePreflightChecks(columns);

    expect(resolved.every((item) => !item.skipped && !item.usedFallback)).toBe(
      true,
    );
    const branch = resolved.find(
      (item) => item.code === 'DEPARTMENT_SLICE_BRANCH_MISMATCH',
    );
    expect(branch?.sql).toContain('d."branchId"');
  });
});
