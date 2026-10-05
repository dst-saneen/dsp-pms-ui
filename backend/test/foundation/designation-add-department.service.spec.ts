import { DesignationService } from '../../src/modules/designation/designation.service';

describe('DesignationService addDepartment onboarding contract', () => {
  it('creates required Company, Branch, and row-version snapshots on a draft', async () => {
    const designation = {
      id: 'designation-1',
      companyId: 'company-1',
      designationCode: 'DEV',
      designationName: 'Developer',
      isActive: true,
      onboardingTemplateId: null,
    };
    const department = {
      id: 'department-1',
      companyId: 'company-1',
      branchId: 'branch-1',
    };
    const tx = {
      designation: {
        findFirst: jest.fn().mockResolvedValue(designation),
        update: jest.fn().mockResolvedValue({}),
      },
      department: {
        findFirst: jest.fn().mockResolvedValue(department),
      },
      onboardingTemplate: {
        create: jest.fn().mockResolvedValue({ id: 'template-1' }),
        findFirst: jest.fn(),
      },
      onboardingTemplateVersion: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null),
        create: jest.fn((args: { data: Record<string, unknown> }) => {
          void args;
          return Promise.resolve({ id: 'version-1' });
        }),
      },
      onboardingTemplateScope: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      onboardingDepartmentTemplate: {
        findFirst: jest.fn().mockResolvedValue(null),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _max: { displayOrder: null } }),
        create: jest.fn((args: { data: Record<string, unknown> }) => {
          void args;
          return Promise.resolve({ id: 'slice-1' });
        }),
      },
    };
    const prisma = {
      designation: { findFirst: jest.fn().mockResolvedValue(designation) },
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const scope = {
      designationWhere: jest.fn().mockReturnValue({ companyId: 'company-1' }),
      assertDepartmentInScope: jest.fn().mockResolvedValue(department),
    };
    const featureGate = {
      isEnabledForContext: jest.fn().mockReturnValue(true),
    };
    const service = new DesignationService(
      prisma as never,
      {} as never,
      {} as never,
      scope as never,
      {} as never,
      featureGate as never,
    );

    await service.addDepartment('designation-1', 'department-1');

    expect(scope.assertDepartmentInScope).toHaveBeenCalledWith(
      'department-1',
      'company-1',
    );
    const [versionArg] = tx.onboardingTemplateVersion.create.mock.calls;
    expect(versionArg[0].data).toMatchObject({
      companyId: 'company-1',
      status: 'DRAFT',
      rowVersion: 1,
    });
    const [deptArg] = tx.onboardingDepartmentTemplate.create.mock.calls;
    expect(deptArg[0].data).toMatchObject({
      companyId: 'company-1',
      branchId: 'branch-1',
      departmentId: 'department-1',
      rowVersion: 1,
    });
  });

  it('does not mutate a published version without an explicit draft', async () => {
    const designation = {
      id: 'designation-1',
      companyId: 'company-1',
      designationCode: 'DEV',
      designationName: 'Developer',
      isActive: true,
      onboardingTemplateId: 'template-1',
    };
    const tx = {
      designation: { findFirst: jest.fn().mockResolvedValue(designation) },
      department: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'department-1',
          companyId: 'company-1',
          branchId: 'branch-1',
        }),
      },
      onboardingTemplate: {
        findFirst: jest.fn().mockResolvedValue({ id: 'template-1' }),
      },
      onboardingTemplateVersion: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'published-1', status: 'PUBLISHED' }),
        create: jest.fn(),
      },
    };
    const prisma = {
      designation: { findFirst: jest.fn().mockResolvedValue(designation) },
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const featureGate = {
      isEnabledForContext: jest.fn().mockReturnValue(true),
    };
    const service = new DesignationService(
      prisma as never,
      {} as never,
      {} as never,
      {
        designationWhere: jest.fn().mockReturnValue({ companyId: 'company-1' }),
        assertDepartmentInScope: jest.fn().mockResolvedValue({
          id: 'department-1',
          branchId: 'branch-1',
        }),
      } as never,
      {} as never,
      featureGate as never,
    );

    await expect(
      service.addDepartment('designation-1', 'department-1'),
    ).rejects.toThrow(/Create a draft template version/);
    expect(tx.onboardingTemplateVersion.create).not.toHaveBeenCalled();
  });

  it('rejects a Department from another Branch on the same draft version', async () => {
    const designation = {
      id: 'designation-1',
      companyId: 'company-1',
      designationCode: 'DEV',
      designationName: 'Developer',
      isActive: true,
      onboardingTemplateId: 'template-1',
    };
    const tx = {
      designation: { findFirst: jest.fn().mockResolvedValue(designation) },
      department: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'department-2',
          companyId: 'company-1',
          branchId: 'branch-2',
        }),
      },
      onboardingTemplate: {
        findFirst: jest.fn().mockResolvedValue({ id: 'template-1' }),
      },
      onboardingTemplateVersion: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'draft-1',
          status: 'DRAFT',
        }),
      },
      onboardingTemplateScope: {
        findFirst: jest.fn().mockResolvedValue({ id: 'scope-1' }),
      },
      onboardingDepartmentTemplate: {
        findFirst: jest.fn().mockResolvedValue({ id: 'slice-other-branch' }),
        create: jest.fn(),
      },
    };
    const prisma = {
      designation: { findFirst: jest.fn().mockResolvedValue(designation) },
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const featureGate = {
      isEnabledForContext: jest.fn().mockReturnValue(true),
    };
    const service = new DesignationService(
      prisma as never,
      {} as never,
      {} as never,
      {
        designationWhere: jest.fn().mockReturnValue({ companyId: 'company-1' }),
        assertDepartmentInScope: jest.fn().mockResolvedValue({
          id: 'department-2',
          companyId: 'company-1',
          branchId: 'branch-2',
        }),
      } as never,
      {} as never,
      featureGate as never,
    );

    await expect(
      service.addDepartment('designation-1', 'department-2'),
    ).rejects.toThrow(/must belong to one Branch/);
    expect(tx.onboardingDepartmentTemplate.create).not.toHaveBeenCalled();
  });
});
