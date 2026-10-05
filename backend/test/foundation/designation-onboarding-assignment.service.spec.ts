import { DesignationOnboardingAssignmentService } from '../../src/modules/onboarding-runtime/services/designation-onboarding-assignment.service';
import { ONBOARDING_ERROR_CODES } from '../../src/modules/onboarding-runtime/constants/onboarding-error-codes';

describe('DesignationOnboardingAssignmentService containment', () => {
  const existing = {
    id: 'assignment-1',
    version: 1,
    designationId: 'designation-1',
    branchId: null,
    isActive: true,
    effectiveFrom: new Date('2026-08-01'),
    effectiveTo: null,
    designation: {
      id: 'designation-1',
      companyId: 'company-1',
      designationCode: 'DEV',
      designationName: 'Developer',
    },
    branch: null,
    onboardingTemplate: {
      id: 'template-1',
      templateCode: 'DEV',
      templateName: 'Developer Onboarding',
    },
  };
  const user = { id: 'user-1' };
  const dto = {
    designationId: 'designation-1',
    branchId: 'branch-1',
    onboardingTemplateId: 'template-2',
    effectiveFrom: '2026-08-20',
    expectedVersion: 1,
    operationId: '11111111-1111-4111-8111-111111111111',
  };

  function createService(options?: {
    template?: Record<string, unknown> | null;
    branchError?: Error;
  }) {
    const prisma = {
      designationOnboardingAssignment: {
        findFirst: jest.fn().mockResolvedValue(existing),
      },
      onboardingTemplate: {
        findFirst: jest.fn().mockResolvedValue(options?.template ?? null),
      },
      $transaction: jest.fn(),
    };
    const scope = {
      designationWhere: jest.fn().mockReturnValue({ companyId: 'company-1' }),
      onboardingTemplateWhere: jest
        .fn()
        .mockReturnValue({ companyId: 'company-1' }),
      assertBranchInScope: options?.branchError
        ? jest.fn().mockRejectedValue(options.branchError)
        : jest.fn().mockResolvedValue({ id: 'branch-1' }),
    };
    const service = new DesignationOnboardingAssignmentService(
      prisma as never,
      scope as never,
      {} as never,
      {
        assertEnabledForContext: jest.fn().mockResolvedValue(undefined),
      } as never,
    );
    return { service, prisma, scope };
  }

  it('returns safe not-found before updating to an out-of-scope Template', async () => {
    const { service, prisma } = createService();

    await expect(
      service.update(user as never, existing.id, dto),
    ).rejects.toMatchObject({
      code: ONBOARDING_ERROR_CODES.ONBOARDING_TEMPLATE_NOT_CONFIGURED,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('revalidates the target Branch before entering the write transaction', async () => {
    const branchError = new Error('branch not found');
    const { service, prisma, scope } = createService({
      template: { id: 'template-2', companyId: 'company-1' },
      branchError,
    });

    await expect(service.update(user as never, existing.id, dto)).rejects.toBe(
      branchError,
    );
    expect(scope.assertBranchInScope).toHaveBeenCalledWith(
      'branch-1',
      'company-1',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
