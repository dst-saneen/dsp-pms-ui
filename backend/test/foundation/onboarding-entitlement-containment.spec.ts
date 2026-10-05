import { ForbiddenException } from '@nestjs/common';

import { DomainNotFoundException } from '../../src/common';
import { OnboardingContributionService } from '../../src/modules/onboarding-contribution/services/onboarding-contribution.service';
import { OnboardingRequirementService } from '../../src/modules/onboarding-requirement/services/onboarding-requirement.service';
import { OnboardingExecutionProfileService } from '../../src/modules/onboarding-execution-profile/services/onboarding-execution-profile.service';
import { OnboardingExecutionRuleService } from '../../src/modules/onboarding-execution-rule/services/onboarding-execution-rule.service';
import { OnboardingEnabledGuard } from '../../src/modules/onboarding-runtime/guards/onboarding-enabled.guard';
import { OnboardingScopeService } from '../../src/modules/onboarding-runtime/services/onboarding-scope.service';
import { OnboardingTemplateScopeService } from '../../src/modules/onboarding-template/services/onboarding-template-scope.service';

describe('onboarding entitlement and direct-ID containment', () => {
  const crossTenant = new DomainNotFoundException(
    'ONBOARDING_TEMPLATE_NOT_FOUND',
    'Record not found.',
  );
  const disabled = new ForbiddenException({
    code: 'ONBOARDING_MODULE_NOT_ENABLED',
  });

  it('denies every guarded HTTP onboarding route when the selected Company is disabled', async () => {
    const featureGate = {
      assertEnabledForContext: jest.fn().mockRejectedValue(disabled),
    };
    const guard = new OnboardingEnabledGuard(featureGate as never);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            authorization: {
              activeCompanyId: 'company-disabled',
              activeBranchId: 'branch-disabled',
            },
          },
        }),
      }),
    };

    await expect(guard.canActivate(context as never)).rejects.toBe(disabled);
    expect(featureGate.assertEnabledForContext).toHaveBeenCalledWith(
      'company-disabled',
      'branch-disabled',
    );
  });

  it('resolves a contribution through tenant scope before checking entitlement', async () => {
    const prisma = {
      contribution: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const featureGate = {
      assertEnabledForContext: jest.fn(),
    };
    const scope = new OnboardingTemplateScopeService(
      prisma as never,
      {
        onboardingTemplateWhere: jest.fn().mockReturnValue({
          companyId: 'company-a',
        }),
      } as never,
      featureGate as never,
    );

    await expect(
      scope.requireContribution('company-b-contribution'),
    ).rejects.toBeInstanceOf(DomainNotFoundException);
    expect(featureGate.assertEnabledForContext).not.toHaveBeenCalled();
  });

  it.each([
    [
      'template',
      (scope: OnboardingTemplateScopeService) =>
        scope.requireTemplate('company-b-template'),
    ],
    [
      'template version',
      (scope: OnboardingTemplateScopeService) =>
        scope.requireVersion('company-b-version'),
    ],
    [
      'department template',
      (scope: OnboardingTemplateScopeService) =>
        scope.requireDepartmentTemplate('company-b-department-template'),
    ],
    [
      'task group',
      (scope: OnboardingTemplateScopeService) =>
        scope.requireTaskGroup('company-b-task-group'),
    ],
    [
      'template task',
      (scope: OnboardingTemplateScopeService) =>
        scope.requireTask('company-b-template-task'),
    ],
    [
      'contribution',
      (scope: OnboardingTemplateScopeService) =>
        scope.requireContribution('company-b-contribution'),
    ],
    [
      'requirement',
      (scope: OnboardingTemplateScopeService) =>
        scope.requireRequirement('company-b-requirement'),
    ],
    [
      'execution profile',
      (scope: OnboardingTemplateScopeService) =>
        scope.requireExecutionProfile('company-b-execution-profile'),
    ],
    [
      'execution rule',
      (scope: OnboardingTemplateScopeService) =>
        scope.requireExecutionRule('company-b-execution-rule'),
    ],
  ])('%s direct ID never crosses tenant scope', async (_label, load) => {
    const prisma = {
      onboardingTemplate: { findFirst: jest.fn().mockResolvedValue(null) },
      onboardingTemplateVersion: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      onboardingDepartmentTemplate: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      onboardingTaskGroup: { findFirst: jest.fn().mockResolvedValue(null) },
      onboardingTemplateTask: { findFirst: jest.fn().mockResolvedValue(null) },
      contribution: { findFirst: jest.fn().mockResolvedValue(null) },
      requirement: { findFirst: jest.fn().mockResolvedValue(null) },
      executionProfile: { findFirst: jest.fn().mockResolvedValue(null) },
      executionRule: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const featureGate = { assertEnabledForContext: jest.fn() };
    const scope = new OnboardingTemplateScopeService(
      prisma as never,
      {
        onboardingTemplateWhere: jest.fn().mockReturnValue({
          companyId: 'company-a',
        }),
      } as never,
      featureGate as never,
    );

    await expect(load(scope)).rejects.toBeInstanceOf(DomainNotFoundException);
    expect(featureGate.assertEnabledForContext).not.toHaveBeenCalled();
  });

  it('does not expose a foreign employee onboarding direct ID', async () => {
    const prisma = {
      employeeOnboarding: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const featureGate = { assertEnabledForContext: jest.fn() };
    const scope = new OnboardingScopeService(
      prisma as never,
      {
        onboardingWhere: jest.fn().mockReturnValue({ companyId: 'company-a' }),
      } as never,
      featureGate as never,
    );

    await expect(
      scope.assertOnboardingInScope('company-b-onboarding'),
    ).rejects.toBeInstanceOf(DomainNotFoundException);
    expect(featureGate.assertEnabledForContext).not.toHaveBeenCalled();
  });

  it('rejects an in-scope contribution when its Company entitlement is disabled', async () => {
    const prisma = {
      contribution: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'contribution-disabled',
          departmentTemplate: {
            companyId: 'company-disabled',
            version: {
              companyId: 'company-disabled',
              onboardingTemplate: { companyId: 'company-disabled' },
            },
          },
        }),
      },
    };
    const featureGate = {
      assertEnabledForContext: jest.fn().mockRejectedValue(disabled),
    };
    const scope = new OnboardingTemplateScopeService(
      prisma as never,
      { onboardingTemplateWhere: jest.fn().mockReturnValue({}) } as never,
      featureGate as never,
    );

    await expect(
      scope.requireContribution('contribution-disabled'),
    ).rejects.toBe(disabled);
    expect(featureGate.assertEnabledForContext).toHaveBeenCalledWith(
      'company-disabled',
    );
  });

  it('never mutates a Contribution after a foreign or disabled direct-ID resolution fails', async () => {
    const prisma = {
      contribution: { update: jest.fn(), create: jest.fn() },
    };
    const validation = {
      ensureContributionExists: jest.fn().mockRejectedValue(crossTenant),
      validateDepartmentTemplate: jest.fn().mockRejectedValue(disabled),
    };
    const service = new OnboardingContributionService(
      prisma as never,
      { log: jest.fn() } as never,
      validation as never,
      {} as never,
    );

    await expect(service.remove('company-b-contribution')).rejects.toBe(
      crossTenant,
    );
    await expect(
      service.create({
        onboardingDepartmentTemplateId: 'department-disabled',
      } as never),
    ).rejects.toBe(disabled);

    expect(prisma.contribution.update).not.toHaveBeenCalled();
    expect(prisma.contribution.create).not.toHaveBeenCalled();
  });

  it.each([
    ['Requirement', OnboardingRequirementService, 'requirement'],
    [
      'Execution profile',
      OnboardingExecutionProfileService,
      'executionProfile',
    ],
    ['Execution rule', OnboardingExecutionRuleService, 'executionRule'],
  ])(
    'does not mutate a %s after foreign direct-ID resolution fails',
    async (_label, Service, key) => {
      const prisma = {
        requirement: { delete: jest.fn() },
        executionProfile: { delete: jest.fn() },
        executionRule: { update: jest.fn() },
      };
      const validation = {
        ensureRequirementExists: jest.fn().mockRejectedValue(crossTenant),
        ensureExecutionProfileExists: jest.fn().mockRejectedValue(crossTenant),
        ensureExecutionRuleExists: jest.fn().mockRejectedValue(crossTenant),
      };

      const Constructor = Service as unknown as new (
        prisma: never,
        audit: never,
        validation: never,
        scope: never,
      ) => { remove(id: string): Promise<unknown> };
      const service = new Constructor(
        prisma as never,
        { log: jest.fn() } as never,
        validation as never,
        {} as never,
      );

      await expect(service.remove(`company-b-${key}`)).rejects.toBe(
        crossTenant,
      );
      expect(prisma.requirement.delete).not.toHaveBeenCalled();
      expect(prisma.executionProfile.delete).not.toHaveBeenCalled();
      expect(prisma.executionRule.update).not.toHaveBeenCalled();
    },
  );
});
