import { ConflictException, NotFoundException } from '@nestjs/common';

import { LeaveBalanceGenerationService } from './leave-balance-generation.service';

describe('LeaveBalanceGenerationService', () => {
  const prisma = {
    employee: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    leaveType: {
      findMany: jest.fn(),
    },
    employeeLeaveBalance: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const organizationScope = {
    assertCurrentCompany: jest.fn(),
    assertCurrentBranch: jest.fn(),
    assertCurrentCompanyGroup: jest.fn(),
    companyGroupIdOrUndefined: jest.fn().mockReturnValue('cg-1'),
    companyIdOrUndefined: jest.fn().mockReturnValue(undefined),
    branchIdOrUndefined: jest.fn().mockReturnValue(undefined),
  };

  const leavePolicyResolver = {
    resolvePolicy: jest.fn(),
  };

  const leaveBalanceLedger = {
    createGeneratedBalance: jest.fn(),
  };

  const service = new LeaveBalanceGenerationService(
    prisma as never,
    organizationScope as never,
    leavePolicyResolver as never,
    leaveBalanceLedger as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    organizationScope.companyGroupIdOrUndefined.mockReturnValue('cg-1');
    organizationScope.companyIdOrUndefined.mockReturnValue(undefined);
    organizationScope.branchIdOrUndefined.mockReturnValue(undefined);
    leaveBalanceLedger.createGeneratedBalance.mockResolvedValue({
      id: 'bal-1',
    });
  });

  it('caps carry forward using the policy limit', () => {
    expect(
      service.calculateCarryForward({
        carryForwardAllowed: true,
        carryForwardLimit: 5,
        previousBalance: 12,
      }),
    ).toBe(5);

    expect(
      service.calculateCarryForward({
        carryForwardAllowed: false,
        carryForwardLimit: 5,
        previousBalance: 12,
      }),
    ).toBe(0);
  });

  it('dry-run reports creates, retains, and missing policies without writing', async () => {
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 'emp-1',
        employeeCode: 'E1',
        companyId: 'co-1',
        branchId: 'br-1',
        departmentId: 'dept-1',
        designationId: null,
      },
    ]);
    prisma.leaveType.findMany.mockResolvedValue([
      { id: 'lt-1', companyId: 'co-1', carryForwardAllowed: true },
      { id: 'lt-2', companyId: 'co-1', carryForwardAllowed: false },
    ]);
    prisma.employeeLeaveBalance.findMany
      .mockResolvedValueOnce([
        {
          id: 'bal-existing',
          employeeId: 'emp-1',
          leaveTypeId: 'lt-1',
          used: 2,
          pending: 1,
        },
      ])
      .mockResolvedValueOnce([]);

    leavePolicyResolver.resolvePolicy.mockImplementation(
      ({ leaveTypeId }: { leaveTypeId: string }) => {
        if (leaveTypeId === 'lt-2') {
          throw new NotFoundException({ code: 'LEAVE_POLICY_NOT_FOUND' });
        }
        return Promise.resolve({
          id: 'policy-1',
          annualEntitlement: 12,
          carryForwardLimit: 3,
        });
      },
    );

    const result = await service.generate({
      year: 2026,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.eligibleEmployeeCount).toBe(1);
    expect(result.existingBalancesToRetain).toBe(1);
    expect(result.balancesToCreate).toBe(0);
    expect(result.createdCount).toBe(0);
    expect(result.employeesWithoutMatchingPolicy).toHaveLength(1);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates missing balances and skips existing used/pending rows', async () => {
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 'emp-1',
        employeeCode: 'E1',
        companyId: 'co-1',
        branchId: 'br-1',
        departmentId: 'dept-1',
        designationId: null,
      },
    ]);
    prisma.leaveType.findMany.mockResolvedValue([
      { id: 'lt-new', companyId: 'co-1', carryForwardAllowed: true },
    ]);
    prisma.employeeLeaveBalance.findMany
      .mockResolvedValueOnce([]) // current year existing
      .mockResolvedValueOnce([
        {
          employeeId: 'emp-1',
          leaveTypeId: 'lt-new',
          balance: 8,
        },
      ]); // previous year

    leavePolicyResolver.resolvePolicy.mockResolvedValue({
      id: 'policy-1',
      annualEntitlement: 12,
      carryForwardLimit: 5,
    });

    prisma.$transaction.mockImplementation(
      async (
        callback: (tx: {
          employeeLeaveBalance: {
            findUnique: jest.Mock;
            create: jest.Mock;
          };
        }) => Promise<unknown>,
      ) => {
        const tx = {
          employeeLeaveBalance: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
          },
        };
        await callback(tx);
        expect(leaveBalanceLedger.createGeneratedBalance).toHaveBeenCalledWith({
          tx,
          employee: {
            id: 'emp-1',
            companyId: 'co-1',
            branchId: 'br-1',
          },
          leaveTypeId: 'lt-new',
          year: 2026,
          annualEntitlement: 12,
          carryForward: 5,
        });
      },
    );

    const result = await service.generate({
      year: 2026,
      dryRun: false,
    });

    expect(result.balancesToCreate).toBe(1);
    expect(result.createdCount).toBe(1);
    expect(result.createPreview[0].carryForward).toBe(5);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('records configuration conflicts without failing the whole run', async () => {
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 'emp-1',
        employeeCode: 'E1',
        companyId: 'co-1',
        branchId: 'br-1',
        departmentId: 'dept-1',
        designationId: null,
      },
    ]);
    prisma.leaveType.findMany.mockResolvedValue([
      { id: 'lt-1', companyId: 'co-1', carryForwardAllowed: false },
    ]);
    prisma.employeeLeaveBalance.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    leavePolicyResolver.resolvePolicy.mockRejectedValue(
      new ConflictException('conflict'),
    );

    const result = await service.generate({ year: 2026, dryRun: true });

    expect(result.configurationErrors).toHaveLength(1);
    expect(result.configurationErrors[0].code).toBe(
      'LEAVE_POLICY_CONFIGURATION_CONFLICT',
    );
    expect(result.balancesToCreate).toBe(0);
  });
});
