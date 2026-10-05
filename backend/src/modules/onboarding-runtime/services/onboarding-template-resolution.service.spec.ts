import { OnboardingTemplateResolutionService } from './onboarding-template-resolution.service';

describe('OnboardingTemplateResolutionService', () => {
  it('prefers branch override over designation default', async () => {
    const branchTemplate = {
      id: 'template-branch',
      templateCode: 'BR',
      templateName: 'Branch Template',
      companyId: 'company-1',
    };
    const defaultTemplate = {
      id: 'template-default',
      templateCode: 'DEF',
      templateName: 'Default Template',
      companyId: 'company-1',
    };

    const tx = {
      designationOnboardingAssignment: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            onboardingTemplate: branchTemplate,
          })
          .mockResolvedValueOnce(null),
      },
      designation: {
        findFirst: jest.fn(),
      },
    };

    const scopeService = {
      assertDesignationInScope: jest.fn(),
      assertBranchInScope: jest.fn(),
      designationWhere: jest.fn().mockReturnValue({}),
    };

    const service = new OnboardingTemplateResolutionService(
      {} as never,
      scopeService as never,
    );

    const resolved = await service.resolve(
      'company-1',
      'branch-1',
      'designation-1',
      new Date(),
      tx as never,
    );

    expect(resolved.onboardingTemplateId).toBe('template-branch');
    expect(resolved.source).toBe('BRANCH_OVERRIDE');
    expect(defaultTemplate.id).not.toBe(resolved.onboardingTemplateId);
  });
});
