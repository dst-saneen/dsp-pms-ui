import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { WorkforceErrorCode } from '../../common/constants';
import { LeavePolicyMatrixService } from './leave-policy-matrix.service';
import { buildLeavePolicyMatrixSnapshotToken } from './leave-policy-matrix.util';

describe('LeavePolicyMatrixService', () => {
  const prisma = {
    leaveType: { findMany: jest.fn() },
    designation: { findMany: jest.fn() },
    leavePolicy: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    employee: { findMany: jest.fn() },
    employeeLeaveBalance: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  const employeeDomainScope = {
    assertBranchInScope: jest.fn(),
    assertDepartmentInScope: jest.fn(),
    leaveTypeWhere: jest.fn().mockReturnValue({}),
    designationWhere: jest.fn().mockReturnValue({}),
    leavePolicyWhere: jest.fn().mockReturnValue({}),
    employeeWhere: jest.fn().mockReturnValue({}),
  };
  const audit = { log: jest.fn().mockResolvedValue({ id: 'audit-1' }) };

  const service = new LeavePolicyMatrixService(
    prisma as never,
    employeeDomainScope as never,
    audit as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    employeeDomainScope.assertBranchInScope.mockResolvedValue({
      id: 'br-1',
      companyId: 'co-1',
    });
    prisma.leaveType.findMany.mockResolvedValue([
      { id: 'lt-1', leaveCode: 'AL', leaveName: 'Annual' },
    ]);
    prisma.designation.findMany.mockResolvedValue([
      { id: 'des-1', designationCode: 'ENG', designationName: 'Engineer' },
    ]);
    prisma.employee.findMany.mockResolvedValue([]);
    prisma.employeeLeaveBalance.findMany.mockResolvedValue([]);
    audit.log.mockResolvedValue({ id: 'audit-1' });
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
  });

  it('404s when the branch is outside tenant scope', async () => {
    employeeDomainScope.assertBranchInScope.mockRejectedValue(
      new NotFoundException('Branch not found'),
    );

    await expect(
      service.getMatrix({ branchId: 'br-other' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns a snapshot token for the designation matrix', async () => {
    const updatedAt = new Date('2026-08-11T00:00:00.000Z');
    prisma.leavePolicy.findMany.mockResolvedValue([
      {
        id: 'pol-1',
        designationId: 'des-1',
        leaveTypeId: 'lt-1',
        annualEntitlement: new Prisma.Decimal(12),
        isActive: true,
        updatedAt,
        carryForwardLimit: null,
        maxConsecutiveDays: null,
        allowNegativeBalance: false,
      },
    ]);

    const result = await service.getMatrix({ branchId: 'br-1' });

    expect(result.snapshotToken).toBe(
      buildLeavePolicyMatrixSnapshotToken([
        {
          id: 'pol-1',
          designationId: 'des-1',
          leaveTypeId: 'lt-1',
          annualEntitlement: new Prisma.Decimal(12),
          isActive: true,
          updatedAt,
        },
      ]),
    );
    expect(result.cells[0]).toEqual(
      expect.objectContaining({
        designationId: 'des-1',
        leaveTypeId: 'lt-1',
        enabled: true,
        annualEntitlement: 12,
      }),
    );
    expect(result.impact.balancesNotUpdated).toBe(true);
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
    expect(prisma.employeeLeaveBalance.findMany).not.toHaveBeenCalled();
  });

  it('rejects a stale snapshot with STALE_POLICY_MATRIX', async () => {
    prisma.leavePolicy.findMany.mockResolvedValue([
      {
        id: 'pol-1',
        designationId: 'des-1',
        leaveTypeId: 'lt-1',
        annualEntitlement: new Prisma.Decimal(12),
        isActive: true,
        updatedAt: new Date('2026-08-11T00:00:00.000Z'),
        carryForwardLimit: null,
        maxConsecutiveDays: null,
        allowNegativeBalance: false,
      },
    ]);

    await expect(
      service.replaceMatrix({
        branchId: 'br-1',
        snapshotToken: 'stale-token',
        reason: 'Adjust engineer annual leave',
        cells: [
          {
            designationId: 'des-1',
            leaveTypeId: 'lt-1',
            enabled: true,
            annualEntitlement: 15,
          },
        ],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: WorkforceErrorCode.STALE_POLICY_MATRIX,
      }) as unknown,
    });
    expect(prisma.leavePolicy.update).not.toHaveBeenCalled();
    expect(prisma.employeeLeaveBalance.create).not.toHaveBeenCalled();
    expect(prisma.employeeLeaveBalance.update).not.toHaveBeenCalled();
  });

  it('saves matrix cells without rewriting leave balances', async () => {
    const updatedAt = new Date('2026-08-11T00:00:00.000Z');
    const existing = [
      {
        id: 'pol-1',
        designationId: 'des-1',
        leaveTypeId: 'lt-1',
        annualEntitlement: new Prisma.Decimal(12),
        isActive: true,
        updatedAt,
        carryForwardLimit: null,
        maxConsecutiveDays: null,
        allowNegativeBalance: false,
      },
    ];
    prisma.leavePolicy.findMany
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce([
        {
          ...existing[0],
          annualEntitlement: new Prisma.Decimal(15),
          updatedAt: new Date('2026-08-11T01:00:00.000Z'),
        },
      ]);
    prisma.leavePolicy.update.mockResolvedValue({});

    const result = await service.replaceMatrix({
      branchId: 'br-1',
      snapshotToken: buildLeavePolicyMatrixSnapshotToken(existing),
      reason: 'Increase engineer annual leave',
      cells: [
        {
          designationId: 'des-1',
          leaveTypeId: 'lt-1',
          enabled: true,
          annualEntitlement: 15,
        },
      ],
    });

    expect(prisma.leavePolicy.update).toHaveBeenCalledWith({
      where: { id: 'pol-1' },
      data: { isActive: true, annualEntitlement: 15 },
    });
    expect(prisma.employeeLeaveBalance.create).not.toHaveBeenCalled();
    expect(prisma.employeeLeaveBalance.update).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      'LeavePolicyMatrix',
      'br-1',
      'UPDATE',
      expect.anything(),
      expect.objectContaining({ updated: 1 }),
      expect.objectContaining({ tx: prisma }),
    );
    expect(result.impact.balancesNotUpdated).toBe(true);
    expect(result.saved).toEqual({
      created: 0,
      updated: 1,
      disabled: 0,
      unchanged: 0,
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('404s foreign departments, designations, and leave types', async () => {
    employeeDomainScope.assertDepartmentInScope.mockRejectedValue(
      new NotFoundException('Department not found'),
    );

    await expect(
      service.getMatrix({ branchId: 'br-1', departmentId: 'dept-other' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    employeeDomainScope.assertDepartmentInScope.mockResolvedValue({
      id: 'dept-1',
    });
    prisma.leavePolicy.findMany.mockResolvedValue([]);

    await expect(
      service.replaceMatrix({
        branchId: 'br-1',
        snapshotToken: buildLeavePolicyMatrixSnapshotToken([]),
        reason: 'Apply foreign designation',
        cells: [
          {
            designationId: 'des-other',
            leaveTypeId: 'lt-1',
            enabled: true,
            annualEntitlement: 10,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      service.replaceMatrix({
        branchId: 'br-1',
        snapshotToken: buildLeavePolicyMatrixSnapshotToken([]),
        reason: 'Apply foreign leave type',
        cells: [
          {
            designationId: 'des-1',
            leaveTypeId: 'lt-other',
            enabled: true,
            annualEntitlement: 10,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.leavePolicy.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate matrix cells', async () => {
    prisma.leavePolicy.findMany.mockResolvedValue([]);

    await expect(
      service.replaceMatrix({
        branchId: 'br-1',
        snapshotToken: buildLeavePolicyMatrixSnapshotToken([]),
        reason: 'Duplicate cells',
        cells: [
          {
            designationId: 'des-1',
            leaveTypeId: 'lt-1',
            enabled: true,
            annualEntitlement: 10,
          },
          {
            designationId: 'des-1',
            leaveTypeId: 'lt-1',
            enabled: true,
            annualEntitlement: 12,
          },
        ],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: 'Duplicate matrix cells are not allowed',
      }) as unknown,
    });
  });

  it('rejects a concurrent save that still holds the pre-save snapshot', async () => {
    const updatedAt = new Date('2026-08-11T00:00:00.000Z');
    const existing = [
      {
        id: 'pol-1',
        designationId: 'des-1',
        leaveTypeId: 'lt-1',
        annualEntitlement: new Prisma.Decimal(12),
        isActive: true,
        updatedAt,
        carryForwardLimit: null,
        maxConsecutiveDays: null,
        allowNegativeBalance: false,
      },
    ];
    const afterSave = [
      {
        ...existing[0],
        annualEntitlement: new Prisma.Decimal(15),
        updatedAt: new Date('2026-08-11T01:00:00.000Z'),
      },
    ];
    prisma.leavePolicy.findMany
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(afterSave)
      .mockResolvedValueOnce(afterSave);
    prisma.leavePolicy.update.mockResolvedValue({});

    const token = buildLeavePolicyMatrixSnapshotToken(existing);
    await service.replaceMatrix({
      branchId: 'br-1',
      snapshotToken: token,
      reason: 'First concurrent writer',
      cells: [
        {
          designationId: 'des-1',
          leaveTypeId: 'lt-1',
          enabled: true,
          annualEntitlement: 15,
        },
      ],
    });

    await expect(
      service.replaceMatrix({
        branchId: 'br-1',
        snapshotToken: token,
        reason: 'Second concurrent writer',
        cells: [
          {
            designationId: 'des-1',
            leaveTypeId: 'lt-1',
            enabled: true,
            annualEntitlement: 18,
          },
        ],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: WorkforceErrorCode.STALE_POLICY_MATRIX,
      }) as unknown,
    });
    expect(prisma.leavePolicy.update).toHaveBeenCalledTimes(1);
  });

  it('rolls back the matrix save when audit logging fails', async () => {
    const existing = [
      {
        id: 'pol-1',
        designationId: 'des-1',
        leaveTypeId: 'lt-1',
        annualEntitlement: new Prisma.Decimal(12),
        isActive: true,
        updatedAt: new Date('2026-08-11T00:00:00.000Z'),
        carryForwardLimit: null,
        maxConsecutiveDays: null,
        allowNegativeBalance: false,
      },
    ];
    prisma.leavePolicy.findMany.mockResolvedValue(existing);
    prisma.leavePolicy.update.mockResolvedValue({});
    audit.log.mockRejectedValue(new Error('audit write failed'));
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => unknown) => {
        try {
          return await callback(prisma);
        } catch (error) {
          prisma.leavePolicy.update.mockClear();
          throw error;
        }
      },
    );

    await expect(
      service.replaceMatrix({
        branchId: 'br-1',
        snapshotToken: buildLeavePolicyMatrixSnapshotToken(existing),
        reason: 'Audit should fail',
        cells: [
          {
            designationId: 'des-1',
            leaveTypeId: 'lt-1',
            enabled: true,
            annualEntitlement: 15,
          },
        ],
      }),
    ).rejects.toThrow('audit write failed');
    expect(prisma.leavePolicy.update).not.toHaveBeenCalled();
    expect(prisma.employeeLeaveBalance.create).not.toHaveBeenCalled();
  });

  it('reports missing balances after save without rewriting them', async () => {
    const existing = [
      {
        id: 'pol-1',
        designationId: 'des-1',
        leaveTypeId: 'lt-1',
        annualEntitlement: new Prisma.Decimal(12),
        isActive: true,
        updatedAt: new Date('2026-08-11T00:00:00.000Z'),
        carryForwardLimit: null,
        maxConsecutiveDays: null,
        allowNegativeBalance: false,
      },
    ];
    prisma.leavePolicy.findMany
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce([
        {
          ...existing[0],
          annualEntitlement: new Prisma.Decimal(15),
        },
      ]);
    prisma.leavePolicy.update.mockResolvedValue({});
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 'emp-1',
        employeeCode: 'E1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        designationId: 'des-1',
      },
    ]);
    prisma.employeeLeaveBalance.findMany.mockResolvedValue([]);

    const result = await service.replaceMatrix({
      branchId: 'br-1',
      snapshotToken: buildLeavePolicyMatrixSnapshotToken(existing),
      reason: 'Increase engineer annual leave',
      cells: [
        {
          designationId: 'des-1',
          leaveTypeId: 'lt-1',
          enabled: true,
          annualEntitlement: 15,
        },
      ],
    });

    expect(result.impact.missingBalanceCount).toBe(1);
    expect(result.impact.balancesNotUpdated).toBe(true);
    expect(prisma.employeeLeaveBalance.create).not.toHaveBeenCalled();
    expect(prisma.employeeLeaveBalance.update).not.toHaveBeenCalled();
  });

  it('rejects enabled cells with zero entitlement', async () => {
    prisma.leavePolicy.findMany.mockResolvedValue([]);

    await expect(
      service.replaceMatrix({
        branchId: 'br-1',
        snapshotToken: buildLeavePolicyMatrixSnapshotToken([]),
        reason: 'Zero entitlement should fail',
        cells: [
          {
            designationId: 'des-1',
            leaveTypeId: 'lt-1',
            enabled: true,
            annualEntitlement: 0,
          },
        ],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: 'Enabled matrix cells require entitlement greater than zero',
      }) as unknown,
    });
    expect(prisma.leavePolicy.create).not.toHaveBeenCalled();
  });

  it('counts unchanged when resubmitting the same enabled entitlement', async () => {
    const existing = [
      {
        id: 'pol-1',
        designationId: 'des-1',
        leaveTypeId: 'lt-1',
        annualEntitlement: new Prisma.Decimal(12),
        isActive: true,
        updatedAt: new Date('2026-08-11T00:00:00.000Z'),
        carryForwardLimit: null,
        maxConsecutiveDays: null,
        allowNegativeBalance: false,
      },
    ];
    prisma.leavePolicy.findMany
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing);

    const result = await service.replaceMatrix({
      branchId: 'br-1',
      snapshotToken: buildLeavePolicyMatrixSnapshotToken(existing),
      reason: 'No actual change',
      cells: [
        {
          designationId: 'des-1',
          leaveTypeId: 'lt-1',
          enabled: true,
          annualEntitlement: 12,
        },
      ],
    });

    expect(prisma.leavePolicy.update).not.toHaveBeenCalled();
    expect(result.saved).toEqual({
      created: 0,
      updated: 0,
      disabled: 0,
      unchanged: 1,
    });
  });

  it('disables active policies when a cell is saved unchecked', async () => {
    const existing = [
      {
        id: 'pol-1',
        designationId: 'des-1',
        leaveTypeId: 'lt-1',
        annualEntitlement: new Prisma.Decimal(12),
        isActive: true,
        updatedAt: new Date('2026-08-11T00:00:00.000Z'),
        carryForwardLimit: null,
        maxConsecutiveDays: null,
        allowNegativeBalance: false,
      },
    ];
    prisma.leavePolicy.findMany
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce([{ ...existing[0], isActive: false }]);
    prisma.leavePolicy.update.mockResolvedValue({});

    const result = await service.replaceMatrix({
      branchId: 'br-1',
      snapshotToken: buildLeavePolicyMatrixSnapshotToken(existing),
      reason: 'Remove engineer annual leave',
      cells: [
        {
          designationId: 'des-1',
          leaveTypeId: 'lt-1',
          enabled: false,
        },
      ],
    });

    expect(prisma.leavePolicy.update).toHaveBeenCalledWith({
      where: { id: 'pol-1' },
      data: { isActive: false },
    });
    expect(result.saved).toEqual({
      created: 0,
      updated: 0,
      disabled: 1,
      unchanged: 0,
    });
  });

  it('disables active designation policies omitted from the replace payload', async () => {
    prisma.designation.findMany.mockResolvedValue([
      { id: 'des-1', designationCode: 'ENG', designationName: 'Engineer' },
      { id: 'des-2', designationCode: 'MGR', designationName: 'Manager' },
    ]);
    const existing = [
      {
        id: 'pol-1',
        designationId: 'des-1',
        leaveTypeId: 'lt-1',
        annualEntitlement: new Prisma.Decimal(12),
        isActive: true,
        updatedAt: new Date('2026-08-11T00:00:00.000Z'),
        carryForwardLimit: null,
        maxConsecutiveDays: null,
        allowNegativeBalance: false,
      },
      {
        id: 'pol-2',
        designationId: 'des-2',
        leaveTypeId: 'lt-1',
        annualEntitlement: new Prisma.Decimal(18),
        isActive: true,
        updatedAt: new Date('2026-08-11T00:00:00.000Z'),
        carryForwardLimit: null,
        maxConsecutiveDays: null,
        allowNegativeBalance: false,
      },
    ];
    prisma.leavePolicy.findMany
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce([
        existing[0],
        { ...existing[1], isActive: false },
      ]);
    prisma.leavePolicy.update.mockResolvedValue({});

    const result = await service.replaceMatrix({
      branchId: 'br-1',
      snapshotToken: buildLeavePolicyMatrixSnapshotToken(existing),
      reason: 'Keep engineer only',
      cells: [
        {
          designationId: 'des-1',
          leaveTypeId: 'lt-1',
          enabled: true,
          annualEntitlement: 12,
        },
      ],
    });

    expect(prisma.leavePolicy.update).toHaveBeenCalledWith({
      where: { id: 'pol-2' },
      data: { isActive: false },
    });
    expect(result.saved).toEqual({
      created: 0,
      updated: 0,
      disabled: 1,
      unchanged: 1,
    });
  });
});
