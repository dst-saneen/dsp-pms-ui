import { NotFoundException } from '@nestjs/common';

import { EmployeeOnboardingTaskRuntimeService } from '../../src/modules/onboarding-runtime/services/employee-onboarding-task-runtime.service';
import { ONBOARDING_PERMISSIONS } from '../../src/modules/onboarding-runtime/constants/onboarding-permissions';

describe('EmployeeOnboardingTaskRuntimeService authorization', () => {
  const task = {
    id: 'task-1',
    onboardingId: 'onboarding-1',
    companyId: 'company-1',
    branchId: 'branch-1',
    employeeId: 'joiner-1',
    executorDepartmentId: 'department-1',
    assignedDepartmentId: 'department-1',
    assignedToUserId: 'assignee-user',
    ownerType: 'DEPARTMENT',
    workType: 'CHECKLIST',
    status: 'NOT_STARTED',
    statusV2: 'PENDING',
    contractVersion: 'V2',
    version: 3,
    attemptNo: 1,
    taskName: 'Prepare workstation',
    isMandatory: true,
    allowSkip: false,
    allowReopen: true,
  };

  const onboarding = {
    id: 'onboarding-1',
    companyId: 'company-1',
    branchId: 'branch-1',
    status: 'IN_PROGRESS',
    statusV2: 'IN_PROGRESS',
    contractVersion: 'V2',
  };

  function buildService(input?: {
    permissions?: string[];
    departmentId?: string;
    allowedActions?: string[];
  }) {
    const prisma = {
      employeeOnboardingTask: {
        findFirst: jest.fn().mockResolvedValue(task),
        update: jest.fn(),
      },
      employeeOnboarding: {
        findFirst: jest.fn().mockResolvedValue(onboarding),
      },
      employee: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const actor = {
      userId: 'department-user',
      isGlobal: false,
      permissions: input?.permissions ?? [
        ONBOARDING_PERMISSIONS.DEPARTMENT_READ,
      ],
      assetGrantedDepartmentIds: [],
      organizationContext: {
        companyId: 'company-1',
        branchId: 'branch-1',
      },
      employeeContext: {
        employeeId: 'department-employee',
        companyId: 'company-1',
        branchId: 'branch-1',
        departmentId: input?.departmentId ?? 'department-1',
        isActive: true,
      },
      roleAssignments: [],
    };
    const capabilityService = {
      calculateTaskActions: jest.fn().mockReturnValue({
        allowedActions: input?.allowedActions ?? [],
        actionCapabilities: [],
        blockedReasons: [],
      }),
    };
    const transactionRunner = {
      run: jest.fn(async (handler: (tx: typeof prisma) => Promise<void>) =>
        handler(prisma),
      ),
    };

    const service = new EmployeeOnboardingTaskRuntimeService(
      prisma as never,
      { onboardingWhere: jest.fn().mockReturnValue({}) } as never,
      { loadOnboarding: jest.fn().mockResolvedValue(onboarding) } as never,
      { resolve: jest.fn().mockResolvedValue(actor) } as never,
      {
        assertEnabledForContext: jest.fn().mockResolvedValue(undefined),
      } as never,
      capabilityService as never,
      {} as never,
      transactionRunner as never,
      {} as never,
      {} as never,
    );

    return { service, prisma, capabilityService };
  }

  it('does not expose assignee candidates to another Department', async () => {
    const { service, prisma } = buildService({
      permissions: [ONBOARDING_PERMISSIONS.DEPARTMENT_ASSIGN],
      departmentId: 'department-2',
    });

    await expect(
      service.assigneeCandidates({ id: 'department-user' } as never, 'task-1', {
        page: 1,
        limit: 10,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
  });

  it('scopes assignee candidates to the task Company, Branch, and Department', async () => {
    const { service, prisma } = buildService({
      permissions: [ONBOARDING_PERMISSIONS.DEPARTMENT_ASSIGN],
    });

    await service.assigneeCandidates(
      { id: 'department-user' } as never,
      'task-1',
      { page: 1, limit: 10 },
    );

    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest asymmetric matchers are intentionally untyped in this mock assertion.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          companyId: 'company-1',
          branchId: 'branch-1',
          departmentId: 'department-1',
          isActive: true,
        }),
      }),
    );
  });

  it('rejects a direct task mutation when the server capability omits the action', async () => {
    const { service, prisma, capabilityService } = buildService({
      permissions: [ONBOARDING_PERMISSIONS.DEPARTMENT_READ],
      allowedActions: [],
    });

    await expect(
      service.unassign({ id: 'department-user' } as never, 'task-1', {
        operationId: '11111111-1111-4111-8111-111111111111',
        expectedTaskVersion: 3,
        reason: 'No longer assigned',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(capabilityService.calculateTaskActions).toHaveBeenCalled();
    expect(prisma.employeeOnboardingTask.update).not.toHaveBeenCalled();
  });
});
