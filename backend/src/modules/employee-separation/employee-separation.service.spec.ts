/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matcher types are intentionally dynamic in these query contract tests. */
import { ConflictException } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth';

import { EmployeeSeparationController } from './employee-separation.controller';
import { EmployeeSeparationService } from './employee-separation.service';

describe('EmployeeSeparationService workflow configuration', () => {
  const tx = {
    employee: {
      findFirst: jest.fn(),
    },
    $executeRaw: jest.fn(),
    employeeSeparation: { findFirst: jest.fn() },
    department: { findMany: jest.fn() },
    approvalWorkflow: { findUnique: jest.fn(), create: jest.fn() },
    approvalWorkflowStep: { createMany: jest.fn() },
  };
  const scope = {
    current: jest.fn().mockReturnValue({ activeCompanyId: 'co-1' }),
    employeeWhere: jest.fn().mockReturnValue({ companyId: 'co-1' }),
  };
  const approvals = {
    resolveWorkflow: jest.fn(),
  };
  const receipts = {
    execute: jest.fn(
      ({
        execute,
      }: {
        execute: (transaction: typeof tx) => Promise<unknown>;
      }) => execute(tx),
    ),
  };
  const service = new EmployeeSeparationService(
    {} as never,
    scope as never,
    approvals as never,
    {} as never,
    receipts as never,
    {} as never,
    {} as never,
  );
  const actor = {
    id: 'user-1',
    authorization: { isGlobal: false, permissions: ['hr.employees.manage'] },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    scope.current.mockReturnValue({ activeCompanyId: 'co-1' });
    scope.employeeWhere.mockReturnValue({ companyId: 'co-1' });
    tx.employee.findFirst.mockResolvedValue({
      id: 'employee-1',
      companyId: 'co-1',
      branchId: 'br-1',
      managerId: 'manager-1',
      company: { companyGroupId: 'group-1' },
    });
    tx.$executeRaw.mockResolvedValue(undefined);
    tx.employeeSeparation.findFirst.mockResolvedValue(null);
    tx.department.findMany.mockResolvedValue([
      { id: 'dept-hr' },
      { id: 'dept-finance' },
      { id: 'dept-it' },
      { id: 'dept-admin' },
    ]);
    tx.approvalWorkflow.findUnique.mockResolvedValue(null);
    tx.approvalWorkflow.create.mockResolvedValue({ id: 'workflow-created' });
    approvals.resolveWorkflow.mockRejectedValue(
      new ConflictException({ code: 'WORKFLOW_NOT_CONFIGURED' }),
    );
  });

  it('does not create or alter a workflow when separation approval is not configured', async () => {
    await expect(
      service.create(
        {
          employeeId: 'employee-1',
          separationType: 'RESIGNATION',
          lastWorkingDate: '2026-10-01',
          reason: 'Leaving the company',
          operationId: 'qa-separation-no-workflow',
          clearanceDepartments: [
            { clearanceType: 'HR', executorDepartmentId: 'dept-hr' },
            { clearanceType: 'FINANCE', executorDepartmentId: 'dept-finance' },
            { clearanceType: 'IT', executorDepartmentId: 'dept-it' },
            { clearanceType: 'ADMIN', executorDepartmentId: 'dept-admin' },
          ],
        },
        actor as never,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.approvalWorkflow.create).not.toHaveBeenCalled();
    expect(tx.approvalWorkflowStep.createMany).not.toHaveBeenCalled();
  });
});

describe('EmployeeSeparationService pending approval queue', () => {
  const actor: AuthenticatedUser = {
    id: 'actor-user-id',
    username: 'actor',
    employeeId: 'actor-employee-id',
    mustChangePassword: false,
    sessionId: 'session-1',
    authorization: {
      roles: ['EMPLOYEE'],
      permissions: ['hr.self.read'],
      scopeLevel: 'COMPANY',
      isGlobal: false,
      activeCompanyId: 'company-1',
      availableScopes: [],
    },
  };

  function queueService(
    prisma: Record<string, unknown>,
    scope: Record<string, unknown> = {},
    clearances: Record<string, unknown> = {},
  ) {
    return new EmployeeSeparationService(
      prisma as never,
      {
        employeeSeparationWhere: () => ({}),
        ...scope,
      } as never,
      {} as never,
      {
        getActorDepartment: jest.fn().mockResolvedValue(null),
        ...clearances,
      } as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  function pendingSeparation(index: number) {
    return {
      id: `separation-${index}`,
      companyId: 'company-1',
      branchId: 'branch-1',
      employeeId: `employee-${index}`,
      separationType: 'RESIGNATION',
      lastWorkingDate: new Date('2026-10-31T00:00:00.000Z'),
      reason: 'Personal reasons',
      status: 'PENDING_APPROVAL',
      version: 1,
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      updatedAt: new Date('2026-09-01T00:00:00.000Z'),
      approvedAt: null,
      completedDate: null,
      createdByUserId: 'creator-user-id',
      branch: { id: 'branch-1', branchCode: 'HQ', branchName: 'Head Office' },
      employee: {
        id: `employee-${index}`,
        employeeCode: `EMP-${index}`,
        firstName: 'Employee',
        lastName: String(index),
        managerId: 'manager-1',
        company: { companyGroupId: 'group-1' },
        department: {
          id: 'department-1',
          departmentCode: 'OPS',
          departmentName: 'Operations',
        },
        designation: null,
      },
      clearance: null,
      approvalTransactionId: `transaction-${index}`,
    };
  }

  it('keeps pending separation filters inside scope and paginates actionable results', async () => {
    const transactionFindMany = jest.fn().mockResolvedValue([
      {
        id: 'approval-transaction-1',
        currentStep: 1,
        approvalSteps: [{ stepNo: 1 }],
      },
      {
        id: 'future-approval-transaction',
        currentStep: 1,
        approvalSteps: [{ stepNo: 2 }],
      },
    ]);
    const separationFindMany = jest.fn().mockResolvedValue([]);
    const scopedWhere = {
      OR: [{ companyId: 'company-1' }, { companyId: 'company-2' }],
    };
    const instance = queueService(
      {
        approvalTransaction: { findMany: transactionFindMany },
        employeeSeparation: {
          findMany: separationFindMany,
          count: jest.fn().mockResolvedValue(0),
        },
      },
      { employeeSeparationWhere: () => scopedWhere },
    );
    const filters = {
      keyword: '  Neha  ',
      branchId: 'branch-2',
      employeeId: 'employee-target',
      separationType: 'resignation',
      submittedFrom: '2026-09-01T00:00:00.000Z',
      submittedTo: '2026-09-30',
      lastWorkingDateFrom: '2026-10-01T00:00:00.000Z',
      lastWorkingDateTo: '2026-10-31',
      page: 2,
      limit: 10,
    };

    const result = await (
      instance as unknown as {
        pendingApprovals: (
          actor: AuthenticatedUser,
          input: typeof filters,
        ) => Promise<{ total: number; page: number; limit: number }>;
      }
    ).pendingApprovals(actor, filters);

    expect(separationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            scopedWhere,
            {
              status: 'PENDING_APPROVAL',
              employeeId: { not: actor.employeeId },
              approvalTransactionId: { in: ['approval-transaction-1'] },
            },
            expect.objectContaining({
              branchId: 'branch-2',
              employeeId: 'employee-target',
              separationType: 'RESIGNATION',
              createdAt: {
                gte: new Date('2026-09-01T00:00:00.000Z'),
                lt: new Date('2026-10-01T00:00:00.000Z'),
              },
              lastWorkingDate: {
                gte: new Date('2026-10-01T00:00:00.000Z'),
                lt: new Date('2026-11-01T00:00:00.000Z'),
              },
              OR: expect.arrayContaining([
                {
                  reason: { contains: 'Neha', mode: 'insensitive' },
                },
                {
                  employee: {
                    employeeCode: { contains: 'Neha', mode: 'insensitive' },
                  },
                },
              ]),
            }),
          ],
        },
        include: expect.objectContaining({
          branch: {
            select: { id: true, branchCode: true, branchName: true },
          },
          employee: expect.objectContaining({
            select: expect.objectContaining({
              department: {
                select: {
                  id: true,
                  departmentCode: true,
                  departmentName: true,
                },
              },
              designation: {
                select: {
                  id: true,
                  designationCode: true,
                  designationName: true,
                },
              },
            }),
          }),
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ total: 0, page: 2, limit: 10 }),
    );
  });

  it('maps API-backed branch, department, and designation labels', async () => {
    const instance = queueService({});
    const record = {
      id: 'separation-1',
      companyId: 'company-1',
      branchId: 'branch-1',
      employeeId: 'employee-1',
      separationType: 'RESIGNATION',
      lastWorkingDate: new Date('2026-10-31T00:00:00.000Z'),
      reason: 'Personal reasons',
      status: 'PENDING_APPROVAL',
      version: 1,
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      updatedAt: new Date('2026-09-01T00:00:00.000Z'),
      approvedAt: null,
      completedDate: null,
      createdByUserId: 'creator-user-id',
      branch: {
        id: 'branch-1',
        branchCode: 'HQ',
        branchName: 'Head Office',
      },
      employee: {
        id: 'employee-1',
        employeeCode: 'EMP-1007',
        firstName: 'Neha',
        lastName: 'Singh',
        managerId: 'manager-1',
        company: { companyGroupId: 'group-1' },
        department: {
          id: 'department-1',
          departmentCode: 'OPS',
          departmentName: 'Operations',
        },
        designation: {
          id: 'designation-1',
          designationCode: 'OPS_EXEC',
          designationName: 'Operations Executive',
        },
      },
      clearance: null,
      approvalTransactionId: 'approval-transaction-1',
      approvalTransaction: {
        currentStep: 1,
        status: 'PENDING',
        approvalSteps: [
          {
            stepNo: 1,
            status: 'PENDING',
            approverId: actor.employeeId,
            approver: {
              id: actor.employeeId,
              employeeCode: 'EMP-APPROVER',
              firstName: 'Alex',
              lastName: 'Manager',
            },
          },
        ],
      },
    };

    const result = await (
      instance as unknown as {
        decorate: (
          input: typeof record,
          actor: AuthenticatedUser,
        ) => Promise<Record<string, unknown>>;
      }
    ).decorate(record, actor);

    expect(result).toMatchObject({
      branch: {
        id: 'branch-1',
        branchCode: 'HQ',
        branchName: 'Head Office',
      },
      employee: {
        id: 'employee-1',
        employeeCode: 'EMP-1007',
        department: {
          id: 'department-1',
          departmentName: 'Operations',
        },
        designation: {
          id: 'designation-1',
          designationName: 'Operations Executive',
        },
      },
    });
  });

  it('forwards pending-separation query parameters from the controller', async () => {
    const pendingApprovals = jest.fn().mockResolvedValue({ items: [] });
    const controller = new EmployeeSeparationController({
      pendingApprovals,
    } as never);
    const filters = { page: 2, limit: 10, keyword: 'Neha' };

    await (
      controller as unknown as {
        pendingApprovals: (
          input: typeof filters,
          request: { user: AuthenticatedUser },
        ) => Promise<unknown>;
      }
    ).pendingApprovals(filters, { user: actor });

    expect(pendingApprovals).toHaveBeenCalledWith(actor, filters);
  });

  it('preserves no-query results and paginates before decoration with one actor lookup', async () => {
    const rows = Array.from({ length: 26 }, (_, index) =>
      pendingSeparation(index),
    );
    const approvals = rows.map((row) => ({
      id: row.approvalTransactionId,
      currentStep: 1,
      status: 'PENDING',
      approvalSteps: [
        {
          stepNo: 1,
          status: 'PENDING',
          approverId: actor.employeeId,
          approver: {
            id: actor.employeeId,
            employeeCode: 'EMP-APPROVER',
            firstName: 'Alex',
            lastName: 'Manager',
          },
        },
      ],
    }));
    const transactionFindMany = jest.fn((args: { include?: unknown }) =>
      Promise.resolve(
        args.include
          ? approvals
          : approvals.map(({ id, currentStep, approvalSteps }) => ({
              id,
              currentStep,
              approvalSteps,
            })),
      ),
    );
    const separationFindMany = jest.fn(
      (args: { skip?: number; take?: number }) =>
        Promise.resolve(
          args.take
            ? rows.slice(args.skip ?? 0, (args.skip ?? 0) + args.take)
            : rows,
        ),
    );
    const getActorDepartment = jest.fn().mockResolvedValue(null);
    const instance = queueService(
      {
        approvalTransaction: { findMany: transactionFindMany },
        employeeSeparation: {
          findMany: separationFindMany,
          count: jest.fn().mockResolvedValue(rows.length),
        },
      },
      {},
      { getActorDepartment },
    );

    const unpaginated = await instance.pendingApprovals(actor);
    const paginated = await instance.pendingApprovals(actor, {
      page: 2,
      limit: 10,
    });

    expect(unpaginated.items).toHaveLength(26);
    expect(separationFindMany.mock.calls[0]?.[0]).not.toHaveProperty('skip');
    expect(separationFindMany.mock.calls[0]?.[0]).not.toHaveProperty('take');
    expect(separationFindMany.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(paginated.items).toHaveLength(10);
    expect(paginated).toEqual(
      expect.objectContaining({ total: 26, page: 2, limit: 10 }),
    );
    expect(getActorDepartment).toHaveBeenCalledTimes(2);
  });
});
