import {
  AssetTrackingMode,
  ReferenceType,
  WorkOwnerType,
  WorkType,
} from '@prisma/client';

import { OnboardingTemplateValidationService } from '../../src/modules/onboarding-template/services/onboarding-template-validation.service';

function buildVersion(overrides?: {
  ownerType?: WorkOwnerType | null;
  workType?: WorkType;
  assignedEmployeeId?: string | null;
  assignedDepartmentId?: string | null;
  allowSkip?: boolean;
  dependsOnTaskId?: string | null;
  approvalWorkflowId?: string | null;
  secondTask?: boolean;
  referenceType?: ReferenceType | null;
  referenceId?: string | null;
}) {
  const taskA = {
    id: 'task-a',
    taskName: 'Laptop',
    sequenceNo: 1,
    ownerType: overrides?.ownerType ?? null,
    workType: overrides?.workType ?? WorkType.CHECKLIST,
    assignedEmployeeId: overrides?.assignedEmployeeId ?? null,
    assignedDesignationId: null,
    assignedDepartmentId: overrides?.assignedDepartmentId ?? 'dept-1',
    assignedDepartment: {
      id: overrides?.assignedDepartmentId ?? 'dept-1',
      companyId: 'co-1',
    },
    approvalWorkflowId: overrides?.approvalWorkflowId ?? null,
    allowSkip: overrides?.allowSkip ?? false,
    dependsOnTaskId: overrides?.dependsOnTaskId ?? null,
    referenceType: overrides?.referenceType ?? null,
    referenceId: overrides?.referenceId ?? null,
  };
  const taskB = {
    id: 'task-b',
    taskName: 'Welcome',
    sequenceNo: 2,
    ownerType: WorkOwnerType.EMPLOYEE,
    workType: WorkType.CHECKLIST,
    assignedEmployeeId: null,
    assignedDesignationId: null,
    assignedDepartmentId: null,
    approvalWorkflowId: null,
    allowSkip: false,
    dependsOnTaskId: 'task-a',
    referenceType: null,
    referenceId: null,
  };

  return {
    id: 'ver-1',
    onboardingTemplateId: 'tpl-1',
    onboardingTemplate: { id: 'tpl-1', companyId: 'co-1', isActive: true },
    scopes: [{ isActive: true }],
    departments: [
      {
        id: 'slice-1',
        departmentId: 'dept-1',
        branchId: 'br-1',
        isActive: true,
        approvalWorkflowId: null,
        department: {
          id: 'dept-1',
          departmentName: 'IT',
          companyId: 'co-1',
          branchId: 'br-1',
        },
        taskGroups: [
          {
            id: 'group-1',
            groupName: 'Setup',
            isActive: true,
            tasks: overrides?.secondTask ? [taskA, taskB] : [taskA],
          },
        ],
      },
    ],
  };
}

describe('OnboardingTemplateValidationService publish contract', () => {
  const templateScope = {
    requireVersion: jest.fn().mockResolvedValue({ id: 'ver-1' }),
    onboardingTemplateVersionWhere: jest.fn().mockReturnValue({}),
  };

  function createService(
    version: ReturnType<typeof buildVersion>,
    assetType: Record<string, unknown> | null = null,
  ) {
    const prisma = {
      onboardingTemplateVersion: {
        findFirst: jest.fn().mockResolvedValue(version),
      },
      designation: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      onboardingTemplateScope: {
        create: jest.fn(),
      },
      assetType: {
        findFirst: jest.fn().mockResolvedValue(assetType),
      },
    };

    return new OnboardingTemplateValidationService(
      prisma as never,
      templateScope as never,
      { requireVersion: jest.fn().mockResolvedValue({ id: 'ver-1' }) } as never,
    );
  }

  it('rejects a missing owner type', async () => {
    const service = createService(buildVersion({ ownerType: null }));
    const result = await service.validate('ver-1');
    expect(
      result.errors.some((item) => item.code === 'TEMPLATE_OWNER_REQUIRED'),
    ).toBe(true);
  });

  it('rejects named employee assignment', async () => {
    const service = createService(
      buildVersion({
        ownerType: WorkOwnerType.DEPARTMENT,
        assignedEmployeeId: 'emp-1',
      }),
    );
    const result = await service.validate('ver-1');
    expect(
      result.errors.some(
        (item) => item.code === 'TEMPLATE_NAMED_ASSIGNMENT_FORBIDDEN',
      ),
    ).toBe(true);
  });

  it('rejects a department owner that does not match the enclosing slice', async () => {
    const service = createService(
      buildVersion({
        ownerType: WorkOwnerType.DEPARTMENT,
        assignedDepartmentId: 'other-dept',
      }),
    );
    const result = await service.validate('ver-1');
    expect(
      result.errors.some(
        (item) => item.code === 'TEMPLATE_DEPARTMENT_MISMATCH',
      ),
    ).toBe(true);
  });

  it('rejects unsupported work types', async () => {
    const service = createService(
      buildVersion({
        ownerType: WorkOwnerType.DEPARTMENT,
        workType: WorkType.DOCUMENT,
      }),
    );
    const result = await service.validate('ver-1');
    expect(
      result.errors.some(
        (item) => item.code === 'TEMPLATE_WORK_TYPE_UNSUPPORTED',
      ),
    ).toBe(true);
  });

  it('rejects approval workflow configuration', async () => {
    const service = createService(
      buildVersion({
        ownerType: WorkOwnerType.DEPARTMENT,
        approvalWorkflowId: 'wf-1',
      }),
    );
    const result = await service.validate('ver-1');
    expect(
      result.errors.some(
        (item) => item.code === 'TEMPLATE_APPROVAL_NOT_SUPPORTED',
      ),
    ).toBe(true);
  });

  it('rejects a skippable prerequisite', async () => {
    const service = createService(
      buildVersion({
        ownerType: WorkOwnerType.DEPARTMENT,
        allowSkip: true,
        secondTask: true,
      }),
    );
    const result = await service.validate('ver-1');
    expect(
      result.errors.some(
        (item) => item.code === 'TEMPLATE_SKIPPABLE_PREREQUISITE',
      ),
    ).toBe(true);
  });

  it('rejects Asset work without an Asset Type reference', async () => {
    const service = createService(
      buildVersion({
        ownerType: WorkOwnerType.DEPARTMENT,
        workType: WorkType.ASSET,
      }),
    );
    const result = await service.validate('ver-1');
    expect(
      result.errors.some((item) => item.code === 'ASSET_TASK_INVALID_TYPE'),
    ).toBe(true);
  });

  it('accepts an enabled individual Asset Type for Department-owned work', async () => {
    const service = createService(
      buildVersion({
        ownerType: WorkOwnerType.DEPARTMENT,
        workType: WorkType.ASSET,
        referenceType: ReferenceType.ASSET_TYPE,
        referenceId: 'asset-type-1',
      }),
      {
        id: 'asset-type-1',
        isActive: true,
        archivedAt: null,
        trackingMode: AssetTrackingMode.INDIVIDUAL,
      },
    );

    const result = await service.validate('ver-1');

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});
