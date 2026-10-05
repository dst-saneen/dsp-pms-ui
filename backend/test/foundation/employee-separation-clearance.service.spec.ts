import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { AuthenticatedUser } from '../../src/modules/auth';
import {
  ClearanceActorDepartment,
  EmployeeClearanceService,
} from '../../src/modules/employee-clearance/employee-clearance.service';
import { EmployeeSeparationService } from '../../src/modules/employee-separation/employee-separation.service';

const clearanceActor: AuthenticatedUser = {
  id: 'user-1',
  username: 'dept-user',
  sessionId: 'session-1',
  mustChangePassword: false,
  employeeId: 'employee-actor',
  authorization: {
    roles: [],
    permissions: ['hr.clearance.department.manage'],
    scopeLevel: 'BRANCH',
    isGlobal: false,
    activeCompanyId: 'company-1',
    activeBranchId: 'branch-1',
    availableScopes: [],
  },
};

const separationManager: AuthenticatedUser = {
  ...clearanceActor,
  authorization: {
    ...clearanceActor.authorization,
    permissions: ['hr.employees.manage'],
  },
};

const itDepartment: ClearanceActorDepartment = {
  companyId: 'company-1',
  branchId: 'branch-1',
  departmentId: 'department-it',
};

function createSeparationService(
  prisma: Record<string, unknown> = {},
  scope: Record<string, unknown> = {},
  clearances: Record<string, unknown> = {},
  receipts: Record<string, unknown> = {},
) {
  return new EmployeeSeparationService(
    prisma as never,
    scope as never,
    {} as never,
    clearances as never,
    receipts as never,
    {} as never,
    {} as never,
  );
}

describe('Employee separation and clearance production guards', () => {
  it('only exposes a manual clearance action to the active executor Department', () => {
    const service = new EmployeeClearanceService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const item: Parameters<
      EmployeeClearanceService['allowedActionsForItem']
    >[0] = {
      clearanceType: 'IT',
      companyId: 'company-1',
      branchId: 'branch-1',
      executorDepartmentId: 'department-it',
      status: 'PENDING',
      clearance: {
        status: 'IN_PROGRESS',
        separation: { status: 'CLEARANCE_IN_PROGRESS' },
      },
    };

    expect(
      service.allowedActionsForItem(item, clearanceActor, itDepartment),
    ).toEqual(['CLEAR']);
    expect(
      service.allowedActionsForItem(item, clearanceActor, {
        ...itDepartment,
        departmentId: 'department-finance',
      }),
    ).toEqual([]);
    expect(
      service.allowedActionsForItem(item, clearanceActor, {
        ...itDepartment,
        companyId: 'company-other',
      }),
    ).toEqual([]);
    expect(
      service.allowedActionsForItem(item, clearanceActor, {
        ...itDepartment,
        branchId: 'branch-other',
      }),
    ).toEqual([]);
    expect(
      service.allowedActionsForItem(
        { ...item, clearanceType: 'ASSET' },
        clearanceActor,
        itDepartment,
      ),
    ).toEqual([]);
  });

  it('requires each explicit manual clearance Department exactly once', async () => {
    const scope = {
      current: jest.fn().mockReturnValue({ activeCompanyId: 'company-1' }),
    };
    type SeparationReceiptCommand = {
      requestPayload: {
        clearanceDepartments: Array<{
          clearanceType: 'HR' | 'FINANCE' | 'IT' | 'ADMIN';
          executorDepartmentId: string;
          itemName?: string;
        }>;
      };
    };
    const receipts = {
      execute: jest
        .fn<Promise<void>, [SeparationReceiptCommand]>()
        .mockResolvedValue(undefined),
    };
    const service = createSeparationService({}, scope, {}, receipts);
    const createInput = {
      employeeId: 'employee-1',
      separationType: 'RESIGNATION' as const,
      lastWorkingDate: '2026-09-01',
      reason: 'Employee resignation',
      operationId: 'operation-1',
      clearanceDepartments: [
        { clearanceType: 'IT' as const, executorDepartmentId: 'department-it' },
        { clearanceType: 'HR' as const, executorDepartmentId: 'department-hr' },
        {
          clearanceType: 'FINANCE' as const,
          executorDepartmentId: 'department-finance',
        },
        {
          clearanceType: 'ADMIN' as const,
          executorDepartmentId: 'department-admin',
        },
      ],
    };

    await expect(
      service.create(
        {
          ...createInput,
          clearanceDepartments: createInput.clearanceDepartments.slice(0, 1),
        },
        separationManager,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await service.create(createInput, separationManager);
    expect(
      receipts.execute.mock.calls[0]?.[0]?.requestPayload.clearanceDepartments,
    ).toEqual([
      {
        clearanceType: 'HR',
        executorDepartmentId: 'department-hr',
        itemName: undefined,
      },
      {
        clearanceType: 'FINANCE',
        executorDepartmentId: 'department-finance',
        itemName: undefined,
      },
      {
        clearanceType: 'IT',
        executorDepartmentId: 'department-it',
        itemName: undefined,
      },
      {
        clearanceType: 'ADMIN',
        executorDepartmentId: 'department-admin',
        itemName: undefined,
      },
    ]);
  });

  it('requires cancellation evidence before issuing an idempotent command', async () => {
    const service = createSeparationService();

    await expect(
      service.cancel(
        'separation-1',
        { expectedVersion: 1, operationId: 'operation-1', reason: '' },
        separationManager,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('only returns active Department candidates in the active employee Company and Branch', async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          companyId: 'company-1',
          branchId: 'branch-1',
        }),
      },
      department: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const scope = {
      current: jest.fn().mockReturnValue({
        activeCompanyId: 'company-1',
        activeBranchId: 'branch-1',
      }),
      employeeWhere: jest.fn().mockReturnValue({
        companyId: 'company-1',
        branchId: 'branch-1',
      }),
    };
    const service = createSeparationService(prisma, scope);

    await service.findClearanceDepartmentCandidates('employee-1');
    expect(prisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: 'company-1',
          branchId: 'branch-1',
          isActive: true,
        },
      }),
    );

    prisma.employee.findFirst.mockResolvedValue({
      companyId: 'company-2',
      branchId: 'branch-1',
    });
    await expect(
      service.findClearanceDepartmentCandidates('employee-other-company'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not block final completion for resolved Asset V2 detail rows', async () => {
    const clearances = {
      getActorDepartment: jest.fn().mockResolvedValue(null),
      allowedActionsForItem: jest.fn().mockReturnValue([]),
    };
    const record = {
      id: 'separation-1',
      companyId: 'company-1',
      branchId: 'branch-1',
      employeeId: 'employee-1',
      separationType: 'RESIGNATION',
      lastWorkingDate: new Date('2026-09-01T00:00:00.000Z'),
      reason: 'reason',
      status: 'CLEARANCE_IN_PROGRESS',
      version: 4,
      createdAt: new Date(),
      updatedAt: new Date(),
      approvedAt: new Date(),
      completedDate: null,
      createdByUserId: 'hr-user',
      approvalTransactionId: null,
      employee: {
        id: 'employee-1',
        employeeCode: 'EMP-1',
        firstName: 'Employee',
        lastName: 'One',
        managerId: null,
        company: { companyGroupId: 'group-1' },
      },
      clearance: {
        id: 'clearance-1',
        status: 'IN_PROGRESS',
        version: 2,
        items: [
          {
            id: 'asset-summary',
            companyId: 'company-1',
            branchId: 'branch-1',
            executorDepartmentId: null,
            clearanceType: 'ASSET',
            itemName: 'Asset Return',
            status: 'PENDING',
            version: 1,
            clearedDate: null,
            clearedBy: null,
            executorDepartment: null,
            assetClearanceDetailItems: [],
          },
          {
            id: 'it-summary',
            companyId: 'company-1',
            branchId: 'branch-1',
            executorDepartmentId: 'department-it',
            clearanceType: 'IT',
            itemName: 'System Access Removal',
            status: 'CLEARED',
            version: 1,
            clearedDate: new Date(),
            clearedBy: {
              id: 'employee-it',
              employeeCode: 'EMP-IT',
              firstName: 'IT',
              lastName: 'Executor',
            },
            executorDepartment: { id: 'department-it', departmentName: 'IT' },
            assetClearanceDetailItems: [],
          },
        ],
      },
    };
    const scope = {
      employeeSeparationWhere: jest.fn().mockReturnValue({}),
    };
    const service = createSeparationService(
      {
        employeeSeparation: {
          findFirst: jest.fn().mockResolvedValue(record),
        },
      },
      scope,
      clearances,
    );

    const response = await service.findOne('separation-1', separationManager);
    expect(response.clearanceSummary?.assetClearanceBlocked).toBe(false);
  });
});
