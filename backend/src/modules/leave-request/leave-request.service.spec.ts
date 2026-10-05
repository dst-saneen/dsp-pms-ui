import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

/* Nested Jest asymmetric matchers are typed as any. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Prisma } from '@prisma/client';

import { LeaveRequestStatus } from '../employee-leave/constants';
import { WorkforceErrorCode } from '../../common/constants';
import { WorkforceTimeErrorCode } from '../../common/constants/workforce-time-error-codes';

import { LeaveRequestService } from './leave-request.service';
import {
  isSerializationFailure,
  isSubmittedLeaveStatus,
} from './leave-request.constants';

describe('leave-request.constants', () => {
  it('treats PENDING as submitted for legacy rows', () => {
    expect(isSubmittedLeaveStatus(LeaveRequestStatus.SUBMITTED)).toBe(true);
    expect(isSubmittedLeaveStatus('PENDING')).toBe(true);
    expect(isSubmittedLeaveStatus(LeaveRequestStatus.DRAFT)).toBe(false);
  });

  it('detects serialization failures', () => {
    expect(isSerializationFailure({ code: 'P2034' })).toBe(true);
    expect(
      isSerializationFailure({ message: 'could not serialize access' }),
    ).toBe(true);
    expect(isSerializationFailure({ code: 'P2002' })).toBe(false);
  });
});

describe('LeaveRequestService state machine', () => {
  const prisma = {
    leaveRequest: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    employeeLeaveBalance: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    approvalWorkflow: {
      findFirst: jest.fn(),
    },
    approvalTransaction: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    approvalTransactionStep: {
      create: jest.fn(),
      update: jest.fn(),
    },
    compOffAllocation: {
      count: jest.fn().mockResolvedValue(0),
    },
    employee: {
      findFirst: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    leaveType: {
      findFirst: jest.fn(),
    },
    leaveRequestCalendarDay: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({}),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn(),
  };

  const leavePolicyResolver = {
    resolveCalculation: jest.fn(),
  };

  const workforceApprovalResolver = {
    resolveWorkflow: jest.fn(),
    resolveApproverEmployeeId: jest.fn(),
    resolveLeaveApprovalSteps: jest.fn(),
    assertCurrentStepActor: jest.fn(),
    isEmployeeScopedLeaveHrActor: jest.fn(),
  };

  const leaveBalanceLedger = {
    reserveRequest: jest.fn(),
    consumeReservation: jest.fn(),
    reverseRequest: jest.fn(),
  };

  const compOffAllocationService = {
    reserveForLeaveRequest: jest.fn(),
    consumeForLeaveRequest: jest.fn(),
    releaseForLeaveRequest: jest.fn(),
  };

  const employeeDomainScope = {
    leaveRequestWhere: jest.fn().mockReturnValue({}),
    leaveTypeWhere: jest.fn().mockReturnValue({}),
    assertEmployeeInScope: jest.fn().mockResolvedValue({
      id: 'emp-1',
      companyId: 'co-1',
    }),
    notFound: jest.fn((entity = 'Record') => {
      throw new NotFoundException(`${entity} not found`);
    }),
  };

  const auditService = {
    log: jest.fn(),
  };

  const outboxWriter = {
    write: jest.fn().mockResolvedValue({ id: 'ob-1', created: true }),
  };

  const defaultChain = {
    currentStep: 2,
    steps: [
      {
        stepNo: 1,
        name: 'REPORTING_MANAGER',
        label: 'Reporting manager',
        approverId: null,
        status: 'SKIPPED',
      },
      {
        stepNo: 2,
        name: 'HR',
        label: 'HR',
        approverId: 'emp-hr',
        status: 'PENDING',
      },
    ],
  };

  const service = new LeaveRequestService(
    prisma as never,
    leavePolicyResolver as never,
    workforceApprovalResolver as never,
    employeeDomainScope as never,
    leaveBalanceLedger as never,
    compOffAllocationService,
    auditService as never,
    outboxWriter as never,
  );

  const actor = {
    id: 'user-1',
    username: 'mgr',
    mustChangePassword: false,
    sessionId: 'sess-1',
    employeeId: 'emp-manager',
    authorization: {
      roles: [],
      permissions: [],
      scopeLevel: 'COMPANY' as const,
      isGlobal: false,
      activeCompanyId: 'co-1',
      availableScopes: [],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    employeeDomainScope.leaveRequestWhere.mockReturnValue({});
    employeeDomainScope.leaveTypeWhere.mockReturnValue({});
    employeeDomainScope.assertEmployeeInScope.mockResolvedValue({
      id: 'emp-1',
      companyId: 'co-1',
    });
    workforceApprovalResolver.resolveWorkflow.mockResolvedValue({
      id: 'wf-1',
      steps: [],
      resolutionSource: 'GLOBAL',
    });
    leaveBalanceLedger.reserveRequest.mockResolvedValue(undefined);
    leaveBalanceLedger.consumeReservation.mockResolvedValue(undefined);
    leaveBalanceLedger.reverseRequest.mockResolvedValue(undefined);
    compOffAllocationService.reserveForLeaveRequest.mockResolvedValue([]);
    compOffAllocationService.consumeForLeaveRequest.mockResolvedValue(
      undefined,
    );
    compOffAllocationService.releaseForLeaveRequest.mockResolvedValue(
      undefined,
    );
    workforceApprovalResolver.resolveApproverEmployeeId.mockResolvedValue(null);
    workforceApprovalResolver.resolveLeaveApprovalSteps.mockResolvedValue(
      defaultChain,
    );
    workforceApprovalResolver.assertCurrentStepActor.mockImplementation(
      () => undefined,
    );
    workforceApprovalResolver.isEmployeeScopedLeaveHrActor.mockResolvedValue(
      false,
    );
    prisma.approvalTransaction.create.mockResolvedValue({ id: 'tx-1' });
    prisma.approvalTransactionStep.create.mockResolvedValue({});
    prisma.$executeRaw.mockResolvedValue(1);
    prisma.user.findMany.mockImplementation(
      ({ where }: { where: { employeeId: { in: string[] } } }) =>
        Promise.resolve(
          where.employeeId.in.map((employeeId) => ({
            id: `user-${employeeId}`,
            employeeId,
          })),
        ),
    );
    outboxWriter.write.mockResolvedValue({ id: 'ob-1', created: true });
    prisma.$transaction.mockImplementation(
      (callback: (transaction: typeof prisma) => unknown, options: unknown) => {
        void options;
        return callback(prisma);
      },
    );
  });

  it('rejects self-approval', async () => {
    prisma.leaveRequest.findFirst.mockResolvedValue({
      id: 'lr-1',
      isActive: true,
      status: LeaveRequestStatus.SUBMITTED,
      employeeId: 'emp-manager',
      requestedDays: 1,
      leaveBalanceId: 'bal-1',
      employee: { companyId: 'co-1' },
      approvalTransaction: null,
      leaveBalance: { pending: 1 },
    });

    await expect(service.approve('lr-1', {}, actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('submits draft and moves days to pending', async () => {
    const draft = {
      id: 'lr-1',
      isActive: true,
      status: LeaveRequestStatus.DRAFT,
      employeeId: 'emp-1',
      leaveTypeId: 'lt-1',
      fromDate: new Date('2026-08-03'),
      toDate: new Date('2026-08-03'),
      isHalfDay: false,
      requestedDays: 1,
      employee: {
        companyId: 'co-1',
        branchId: 'br-1',
        managerId: null,
        company: { id: 'co-1', companyGroupId: 'g-1' },
      },
      leaveType: { category: 'STANDARD' },
    };
    prisma.leaveRequest.findFirst
      .mockResolvedValueOnce(draft)
      .mockResolvedValue(null);
    leavePolicyResolver.resolveCalculation.mockResolvedValue({
      fromCalendarDate: '2026-08-03',
      requestedWorkingDays: 1,
      allowNegativeBalance: false,
      maximumNegativeBalance: null,
      policyId: 'pol-1',
    });
    prisma.employeeLeaveBalance.findFirst.mockResolvedValue({
      id: 'bal-1',
      balance: 5,
    });
    workforceApprovalResolver.resolveWorkflow.mockResolvedValue({
      id: 'wf-1',
      steps: [],
      resolutionSource: 'GLOBAL',
    });
    prisma.leaveRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.leaveRequest.findUniqueOrThrow.mockResolvedValue({
      id: 'lr-1',
      employeeId: 'emp-1',
      status: LeaveRequestStatus.SUBMITTED,
      requestedDays: 1,
      employee: {
        companyId: 'co-1',
        branchId: 'br-1',
        company: { id: 'co-1', companyGroupId: 'g-1' },
      },
    });

    const result = await service.submit('lr-1', actor);

    expect(leaveBalanceLedger.reserveRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        leaveBalance: expect.objectContaining({ id: 'bal-1' }),
        pendingDelta: 1,
        balanceDelta: -1,
      }),
    );
    expect(prisma.leaveRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: LeaveRequestStatus.SUBMITTED,
        }) as unknown,
      }),
    );
    expect(result.status).toBe(LeaveRequestStatus.SUBMITTED);
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
    expect(leavePolicyResolver.resolveCalculation).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 'emp-1',
        leaveTypeId: 'lt-1',
        client: prisma,
      }),
    );
    expect(outboxWriter.write).toHaveBeenCalledTimes(2);
    expect(outboxWriter.write).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        eventType: 'LEAVE_REQUEST_SUBMITTED',
        payload: expect.objectContaining({
          recipientUserIds: ['user-emp-hr'],
        }),
      }),
    );
    expect(outboxWriter.write).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        eventType: 'LEAVE_REQUEST_SUBMITTED_REQUESTER',
        payload: expect.objectContaining({
          recipientUserIds: ['user-emp-1'],
        }),
      }),
    );
  });

  it('throws LEAVE_STATE_CHANGED when draft disappears during submit', async () => {
    const draft = {
      id: 'lr-1',
      isActive: true,
      status: LeaveRequestStatus.DRAFT,
      employeeId: 'emp-1',
      leaveTypeId: 'lt-1',
      fromDate: new Date('2026-08-03'),
      toDate: new Date('2026-08-03'),
      isHalfDay: false,
      employee: {
        companyId: 'co-1',
        branchId: 'br-1',
        managerId: null,
        company: { id: 'co-1', companyGroupId: 'g-1' },
      },
      leaveType: { category: 'STANDARD' },
    };
    prisma.leaveRequest.findFirst
      .mockResolvedValueOnce(draft)
      .mockResolvedValue(null);
    leavePolicyResolver.resolveCalculation.mockResolvedValue({
      fromCalendarDate: '2026-08-03',
      requestedWorkingDays: 1,
      allowNegativeBalance: false,
      maximumNegativeBalance: null,
    });
    prisma.employeeLeaveBalance.findFirst.mockResolvedValue({
      id: 'bal-1',
      balance: 5,
    });
    workforceApprovalResolver.resolveWorkflow.mockResolvedValue({
      id: 'wf-1',
      steps: [],
      resolutionSource: 'GLOBAL',
    });
    prisma.leaveRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.submit('lr-1', actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('cancels approved leave and restores used days when reason provided', async () => {
    const managerActor = {
      ...actor,
      employeeId: 'emp-manager',
    };

    prisma.leaveRequest.findFirst.mockResolvedValue({
      id: 'lr-1',
      isActive: true,
      status: LeaveRequestStatus.APPROVED,
      employeeId: 'emp-1',
      requestedDays: 2,
      leaveBalanceId: 'bal-1',
      fromDate: new Date('2026-08-03'),
      employee: { companyId: 'co-1' },
    });
    prisma.employeeLeaveBalance.findUnique.mockResolvedValue({
      id: 'bal-1',
      employeeId: 'emp-1',
      leaveTypeId: 'lt-1',
      year: 2026,
      entitlement: 12,
      used: 2,
      pending: 0,
      balance: 10,
      employee: { companyId: 'co-1', branchId: 'br-1' },
    });
    prisma.leaveRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.leaveRequest.findUniqueOrThrow.mockResolvedValue({
      id: 'lr-1',
      status: LeaveRequestStatus.CANCELLED,
    });

    await service.cancel('lr-1', { reason: 'Project cancelled' }, managerActor);

    expect(leaveBalanceLedger.reverseRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        leaveBalance: expect.objectContaining({ id: 'bal-1' }),
        usedDelta: -2,
        balanceDelta: 2,
      }),
    );
  });

  it('requires rejection remarks', async () => {
    prisma.leaveRequest.findFirst.mockResolvedValue({
      id: 'lr-1',
      isActive: true,
      status: LeaveRequestStatus.SUBMITTED,
      employeeId: 'emp-1',
      requestedDays: 1,
      leaveBalanceId: 'bal-1',
      employee: { companyId: 'co-1' },
      approvalTransaction: null,
    });

    await expect(
      service.reject('lr-1', { remarks: '' }, actor),
    ).rejects.toBeInstanceOf(Error);
  });

  it('returns not found for missing leave request', async () => {
    prisma.leaveRequest.findFirst.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('blocks editing non-draft leave requests', async () => {
    prisma.leaveRequest.findFirst.mockResolvedValue({
      id: 'lr-1',
      isActive: true,
      status: LeaveRequestStatus.SUBMITTED,
      employeeId: 'emp-1',
      leaveTypeId: 'lt-1',
      fromDate: new Date('2026-08-03'),
      toDate: new Date('2026-08-03'),
      isHalfDay: false,
      reason: null,
      attachmentUrl: null,
      employee: true,
      leaveType: true,
    });

    await expect(
      service.update('lr-1', { reason: 'changed' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows draft edits and recalculates requested days', async () => {
    const draft = {
      id: 'lr-1',
      isActive: true,
      status: LeaveRequestStatus.DRAFT,
      employeeId: 'emp-1',
      leaveTypeId: 'lt-1',
      fromDate: new Date('2026-08-03'),
      toDate: new Date('2026-08-03'),
      isHalfDay: false,
      reason: null,
      attachmentUrl: null,
      requestedDays: 1,
      employee: true,
      leaveType: true,
    };
    prisma.leaveRequest.findFirst
      .mockResolvedValueOnce(draft)
      .mockResolvedValue(null);
    prisma.leaveType.findFirst.mockResolvedValue({
      id: 'lt-1',
      category: 'STANDARD',
    });
    leavePolicyResolver.resolveCalculation.mockResolvedValue({
      requestedWorkingDays: 2,
    });
    prisma.leaveRequest.update.mockResolvedValue({
      id: 'lr-1',
      status: LeaveRequestStatus.DRAFT,
      requestedDays: 2,
    });

    const result = await service.update('lr-1', {
      toDate: '2026-08-04',
    });

    expect(prisma.leaveRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requestedDays: 2,
        }) as unknown,
      }),
    );
    expect(result.requestedDays).toBe(2);
  });

  it('rejects create when an overlapping submitted leave exists', async () => {
    leavePolicyResolver.resolveCalculation.mockResolvedValue({
      requestedWorkingDays: 1,
    });
    prisma.leaveType.findFirst.mockResolvedValue({
      id: 'lt-1',
      companyId: 'co-1',
    });
    prisma.leaveRequest.findFirst.mockResolvedValue({ id: 'lr-existing' });

    await expect(
      service.create({
        employeeId: 'emp-1',
        leaveTypeId: 'lt-1',
        fromDate: '2026-08-03',
        toDate: '2026-08-03',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: WorkforceErrorCode.LEAVE_OVERLAP,
      }) as unknown,
    });
  });

  it('rejects submit when balance is insufficient', async () => {
    const draft = {
      id: 'lr-1',
      isActive: true,
      status: LeaveRequestStatus.DRAFT,
      employeeId: 'emp-1',
      leaveTypeId: 'lt-1',
      fromDate: new Date('2026-08-03'),
      toDate: new Date('2026-08-03'),
      isHalfDay: false,
      employee: {
        companyId: 'co-1',
        branchId: 'br-1',
        managerId: null,
        company: { id: 'co-1', companyGroupId: 'g-1' },
      },
      leaveType: { category: 'STANDARD' },
    };
    prisma.leaveRequest.findFirst
      .mockResolvedValueOnce(draft)
      .mockResolvedValue(null);
    leavePolicyResolver.resolveCalculation.mockResolvedValue({
      fromCalendarDate: '2026-08-03',
      requestedWorkingDays: 2,
      allowNegativeBalance: false,
      maximumNegativeBalance: null,
    });
    prisma.employeeLeaveBalance.findFirst.mockResolvedValue({
      id: 'bal-1',
      balance: 1,
    });

    await expect(service.submit('lr-1', actor)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: WorkforceErrorCode.LEAVE_BALANCE_INSUFFICIENT,
      }) as unknown,
    });
  });

  it('allows controlled negative balance when policy permits', async () => {
    const draft = {
      id: 'lr-1',
      isActive: true,
      status: LeaveRequestStatus.DRAFT,
      employeeId: 'emp-1',
      leaveTypeId: 'lt-1',
      fromDate: new Date('2026-08-03'),
      toDate: new Date('2026-08-03'),
      isHalfDay: false,
      requestedDays: 2,
      employee: {
        companyId: 'co-1',
        branchId: 'br-1',
        managerId: null,
        company: { id: 'co-1', companyGroupId: 'g-1' },
      },
      leaveType: { category: 'STANDARD' },
    };
    prisma.leaveRequest.findFirst
      .mockResolvedValueOnce(draft)
      .mockResolvedValue(null);
    leavePolicyResolver.resolveCalculation.mockResolvedValue({
      fromCalendarDate: '2026-08-03',
      requestedWorkingDays: 2,
      allowNegativeBalance: true,
      maximumNegativeBalance: 2,
      policyId: 'pol-1',
    });
    prisma.employeeLeaveBalance.findFirst.mockResolvedValue({
      id: 'bal-1',
      balance: 0,
    });
    workforceApprovalResolver.resolveWorkflow.mockResolvedValue({
      id: 'wf-1',
      steps: [],
      resolutionSource: 'GLOBAL',
    });
    prisma.leaveRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.leaveRequest.findUniqueOrThrow.mockResolvedValue({
      id: 'lr-1',
      status: LeaveRequestStatus.SUBMITTED,
      requestedDays: 2,
    });

    await service.submit('lr-1', actor);

    expect(leaveBalanceLedger.reserveRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        leaveBalance: expect.objectContaining({ id: 'bal-1' }),
        pendingDelta: 2,
        balanceDelta: -2,
      }),
    );
  });

  it('restores pending balance on rejection', async () => {
    prisma.leaveRequest.findFirst.mockResolvedValue({
      id: 'lr-1',
      isActive: true,
      status: LeaveRequestStatus.SUBMITTED,
      employeeId: 'emp-1',
      requestedDays: 1.5,
      leaveBalanceId: 'bal-1',
      fromDate: new Date('2026-08-03'),
      employee: { companyId: 'co-1' },
      approvalTransaction: null,
    });
    prisma.employeeLeaveBalance.findUnique.mockResolvedValue({
      id: 'bal-1',
      employeeId: 'emp-1',
      leaveTypeId: 'lt-1',
      year: 2026,
      entitlement: 12,
      used: 0,
      pending: 1.5,
      balance: 10.5,
      employee: { companyId: 'co-1', branchId: 'br-1' },
    });
    prisma.leaveRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.leaveRequest.findUniqueOrThrow.mockResolvedValue({
      id: 'lr-1',
      status: LeaveRequestStatus.REJECTED,
    });

    await service.reject('lr-1', { remarks: 'Coverage gap' }, actor);

    expect(leaveBalanceLedger.reverseRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        leaveBalance: expect.objectContaining({ id: 'bal-1' }),
        pendingDelta: -1.5,
        balanceDelta: 1.5,
      }),
    );
  });

  it('cancels submitted leave and restores pending days', async () => {
    prisma.leaveRequest.findFirst.mockResolvedValue({
      id: 'lr-1',
      isActive: true,
      status: LeaveRequestStatus.SUBMITTED,
      employeeId: 'emp-1',
      requestedDays: 1,
      leaveBalanceId: 'bal-1',
      fromDate: new Date('2026-08-03'),
      employee: { companyId: 'co-1' },
    });
    prisma.employeeLeaveBalance.findUnique.mockResolvedValue({
      id: 'bal-1',
      employeeId: 'emp-1',
      leaveTypeId: 'lt-1',
      year: 2026,
      entitlement: 12,
      used: 0,
      pending: 1,
      balance: 11,
      employee: { companyId: 'co-1', branchId: 'br-1' },
    });
    prisma.leaveRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.leaveRequest.findUniqueOrThrow.mockResolvedValue({
      id: 'lr-1',
      status: LeaveRequestStatus.CANCELLED,
    });

    await service.cancel(
      'lr-1',
      { reason: 'Plans changed' },
      {
        ...actor,
        employeeId: 'emp-1',
      },
    );

    expect(leaveBalanceLedger.reverseRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        leaveBalance: expect.objectContaining({ id: 'bal-1' }),
        pendingDelta: -1,
        balanceDelta: 1,
      }),
    );
  });

  it('throws LEAVE_STATE_CHANGED when approval loses the race', async () => {
    prisma.leaveRequest.findFirst.mockResolvedValue({
      id: 'lr-1',
      isActive: true,
      status: LeaveRequestStatus.SUBMITTED,
      employeeId: 'emp-1',
      requestedDays: 1,
      leaveBalanceId: 'bal-1',
      leaveTypeId: 'lt-1',
      fromDate: new Date('2026-08-03'),
      toDate: new Date('2026-08-03'),
      employee: { companyId: 'co-1' },
      approvalTransaction: null,
      leaveBalance: { pending: 1, used: 0 },
    });
    prisma.employeeLeaveBalance.findUnique.mockResolvedValue({
      id: 'bal-1',
      pending: 1,
      used: 0,
    });
    prisma.leaveRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.approve('lr-1', {}, actor)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: WorkforceErrorCode.LEAVE_STATE_CHANGED,
      }) as unknown,
    });
  });

  it('fails submit when no HR approver is available and does not reserve', async () => {
    const draft = {
      id: 'lr-1',
      isActive: true,
      status: LeaveRequestStatus.DRAFT,
      employeeId: 'emp-1',
      leaveTypeId: 'lt-1',
      fromDate: new Date('2026-08-03'),
      toDate: new Date('2026-08-03'),
      isHalfDay: false,
      employee: {
        companyId: 'co-1',
        branchId: 'br-1',
        managerId: 'emp-manager',
        company: { id: 'co-1', companyGroupId: 'g-1' },
      },
      leaveType: { category: 'STANDARD' },
    };
    prisma.leaveRequest.findFirst
      .mockResolvedValueOnce(draft)
      .mockResolvedValue(null);
    leavePolicyResolver.resolveCalculation.mockResolvedValue({
      fromCalendarDate: '2026-08-03',
      requestedWorkingDays: 1,
      allowNegativeBalance: false,
      maximumNegativeBalance: null,
    });
    prisma.employeeLeaveBalance.findFirst.mockResolvedValue({
      id: 'bal-1',
      balance: 5,
    });
    workforceApprovalResolver.resolveLeaveApprovalSteps.mockRejectedValue(
      new ConflictException({
        code: WorkforceErrorCode.LEAVE_APPROVER_NOT_AVAILABLE,
        message: 'No eligible HR approver is available for this leave request',
      }),
    );

    await expect(service.submit('lr-1', actor)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: WorkforceErrorCode.LEAVE_APPROVER_NOT_AVAILABLE,
      }) as unknown,
    });
    expect(leaveBalanceLedger.reserveRequest).not.toHaveBeenCalled();
    expect(prisma.approvalTransaction.create).not.toHaveBeenCalled();
  });

  it('keeps the reservation when the reporting manager approves', async () => {
    prisma.leaveRequest.findFirst.mockResolvedValue({
      id: 'lr-1',
      isActive: true,
      status: LeaveRequestStatus.SUBMITTED,
      employeeId: 'emp-1',
      requestedDays: 1,
      leaveBalanceId: 'bal-1',
      fromDate: new Date('2026-08-03'),
      employee: { companyId: 'co-1', branchId: 'br-1' },
      approvalTransaction: {
        id: 'tx-1',
        currentStep: 1,
        status: 'PENDING',
        workflow: {
          steps: [
            {
              stepNo: 1,
              approverType: 'REPORTING_MANAGER',
              approverRole: null,
            },
            { stepNo: 2, approverType: 'ROLE', approverRole: 'HR_MANAGER' },
          ],
        },
        approvalSteps: [
          {
            id: 's1',
            stepNo: 1,
            status: 'PENDING',
            approverId: 'emp-manager',
            actionDate: null,
          },
          {
            id: 's2',
            stepNo: 2,
            status: 'PENDING',
            approverId: 'emp-hr',
            actionDate: null,
          },
        ],
      },
      leaveBalance: { pending: 1 },
    });
    prisma.approvalTransactionStep.update.mockResolvedValue({});
    prisma.approvalTransaction.update.mockResolvedValue({});
    prisma.leaveRequest.findUniqueOrThrow.mockResolvedValue({
      id: 'lr-1',
      employeeId: 'emp-1',
      status: LeaveRequestStatus.SUBMITTED,
      requestedDays: 1,
      employee: {
        companyId: 'co-1',
        branchId: 'br-1',
        company: { id: 'co-1', companyGroupId: 'g-1' },
      },
      approvalTransaction: {
        currentStep: 2,
        approvalSteps: [
          {
            stepNo: 1,
            status: 'APPROVED',
            approverId: 'emp-manager',
            actionDate: new Date(),
          },
          {
            stepNo: 2,
            status: 'PENDING',
            approverId: 'emp-hr',
            actionDate: null,
          },
        ],
        workflow: {
          steps: [
            {
              stepNo: 1,
              approverType: 'REPORTING_MANAGER',
              approverRole: null,
            },
            { stepNo: 2, approverType: 'ROLE', approverRole: 'HR_MANAGER' },
          ],
        },
      },
    });

    const result = await service.approve('lr-1', {}, actor);

    expect(leaveBalanceLedger.consumeReservation).not.toHaveBeenCalled();
    expect(prisma.leaveRequest.updateMany).not.toHaveBeenCalled();
    expect(result.approvalProgress.stage).toBe('HR_REVIEW');
    expect(outboxWriter.write).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        eventType: 'LEAVE_REQUEST_SUBMITTED',
        payload: expect.objectContaining({
          recipientUserIds: ['user-emp-hr'],
        }),
        dedupeKey: 'leave-request:lr-1:approver-step-2',
      }),
    );
  });

  it('consumes the reservation only on final HR approval', async () => {
    prisma.leaveRequest.findFirst.mockResolvedValue({
      id: 'lr-1',
      isActive: true,
      status: LeaveRequestStatus.SUBMITTED,
      employeeId: 'emp-1',
      requestedDays: 1,
      leaveBalanceId: 'bal-1',
      fromDate: new Date('2026-08-03'),
      employee: { companyId: 'co-1', branchId: 'br-1' },
      approvalTransaction: {
        id: 'tx-1',
        currentStep: 2,
        status: 'PENDING',
        workflow: {
          steps: [
            {
              stepNo: 1,
              approverType: 'REPORTING_MANAGER',
              approverRole: null,
            },
            { stepNo: 2, approverType: 'ROLE', approverRole: 'HR_MANAGER' },
          ],
        },
        approvalSteps: [
          {
            id: 's1',
            stepNo: 1,
            status: 'APPROVED',
            approverId: 'emp-manager',
            actionDate: new Date(),
          },
          {
            id: 's2',
            stepNo: 2,
            status: 'PENDING',
            approverId: 'emp-hr',
            actionDate: null,
          },
        ],
      },
      leaveBalance: { pending: 1 },
    });
    prisma.employeeLeaveBalance.findUnique.mockResolvedValue({
      id: 'bal-1',
      pending: 1,
      used: 0,
    });
    prisma.leaveRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.leaveRequest.findUniqueOrThrow.mockResolvedValue({
      id: 'lr-1',
      employeeId: 'emp-1',
      status: LeaveRequestStatus.APPROVED,
      approvedDays: 1,
      requestedDays: 1,
      employee: {
        companyId: 'co-1',
        branchId: 'br-1',
        company: { id: 'co-1', companyGroupId: 'g-1' },
      },
    });

    const hrActor = { ...actor, employeeId: 'emp-hr' };
    const result = await service.approve('lr-1', {}, hrActor);

    expect(leaveBalanceLedger.consumeReservation).toHaveBeenCalled();
    expect(result.status).toBe(LeaveRequestStatus.APPROVED);
    expect(outboxWriter.write).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        eventType: 'LEAVE_REQUEST_APPROVED',
        payload: expect.objectContaining({
          recipientUserIds: ['user-emp-1'],
        }),
        dedupeKey: 'leave-request:lr-1:requester-approved',
      }),
    );
  });

  it('returns 409 when the current approval step was already decided', async () => {
    prisma.leaveRequest.findFirst.mockResolvedValue({
      id: 'lr-1',
      isActive: true,
      status: LeaveRequestStatus.SUBMITTED,
      employeeId: 'emp-1',
      requestedDays: 1,
      leaveBalanceId: 'bal-1',
      fromDate: new Date('2026-08-03'),
      employee: { companyId: 'co-1', branchId: 'br-1' },
      approvalTransaction: {
        id: 'tx-1',
        currentStep: 1,
        status: 'PENDING',
        workflow: {
          steps: [
            {
              stepNo: 1,
              approverType: 'REPORTING_MANAGER',
              approverRole: null,
            },
          ],
        },
        approvalSteps: [
          {
            id: 's1',
            stepNo: 1,
            status: 'APPROVED',
            approverId: 'emp-manager',
            actionDate: new Date(),
          },
        ],
      },
      leaveBalance: { pending: 1 },
    });
    workforceApprovalResolver.assertCurrentStepActor.mockImplementation(() => {
      throw new ConflictException({
        code: WorkforceTimeErrorCode.STALE_TRANSITION,
        message: 'Approval step has already been decided',
      });
    });

    await expect(service.approve('lr-1', {}, actor)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: WorkforceTimeErrorCode.STALE_TRANSITION,
      }),
    });
    expect(leaveBalanceLedger.consumeReservation).not.toHaveBeenCalled();
    expect(prisma.approvalTransactionStep.update).not.toHaveBeenCalled();
  });

  it('rolls back submit when audit logging fails', async () => {
    const draft = {
      id: 'lr-1',
      isActive: true,
      status: LeaveRequestStatus.DRAFT,
      employeeId: 'emp-1',
      leaveTypeId: 'lt-1',
      fromDate: new Date('2026-08-03'),
      toDate: new Date('2026-08-03'),
      isHalfDay: false,
      requestedDays: 1,
      employee: {
        companyId: 'co-1',
        branchId: 'br-1',
        managerId: null,
        company: { id: 'co-1', companyGroupId: 'g-1' },
      },
      leaveType: { category: 'STANDARD' },
    };
    prisma.leaveRequest.findFirst
      .mockResolvedValueOnce(draft)
      .mockResolvedValue(null);
    leavePolicyResolver.resolveCalculation.mockResolvedValue({
      fromCalendarDate: '2026-08-03',
      requestedWorkingDays: 1,
      allowNegativeBalance: false,
      maximumNegativeBalance: null,
      policyId: 'pol-1',
    });
    prisma.employeeLeaveBalance.findFirst.mockResolvedValue({
      id: 'bal-1',
      balance: 5,
    });
    prisma.leaveRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.leaveRequest.findUniqueOrThrow.mockResolvedValue({
      id: 'lr-1',
      status: LeaveRequestStatus.SUBMITTED,
      requestedDays: 1,
    });
    auditService.log.mockRejectedValue(new Error('audit write failed'));
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => unknown) => {
        try {
          return await callback(prisma);
        } catch (error) {
          leaveBalanceLedger.reserveRequest.mockClear();
          prisma.leaveRequest.updateMany.mockClear();
          outboxWriter.write.mockClear();
          throw error;
        }
      },
    );

    await expect(service.submit('lr-1', actor)).rejects.toThrow(
      'audit write failed',
    );
    expect(leaveBalanceLedger.reserveRequest).not.toHaveBeenCalled();
    expect(outboxWriter.write).not.toHaveBeenCalled();
  });

  it('lists HR-review leave in tenant scope for HR even when another HR is assigned', async () => {
    const hrActor = {
      ...actor,
      employeeId: 'emp-hr-2',
      authorization: {
        ...actor.authorization,
        permissions: ['hr.leave.manage'],
        roles: ['HR_MANAGER'],
      },
    };
    const row = {
      id: 'lr-1',
      isActive: true,
      status: LeaveRequestStatus.SUBMITTED,
      employeeId: 'emp-1',
      requestedDays: 1,
      employee: {
        companyId: 'co-1',
        branchId: 'br-1',
        company: { id: 'co-1', companyGroupId: 'g-1' },
      },
      approvalTransaction: {
        currentStep: 2,
        status: 'PENDING',
        workflow: {
          steps: [
            {
              stepNo: 1,
              approverType: 'REPORTING_MANAGER',
              approverRole: null,
            },
            {
              stepNo: 2,
              approverType: 'ROLE',
              approverRole: 'HR_MANAGER',
            },
          ],
        },
        approvalSteps: [
          {
            stepNo: 1,
            status: 'APPROVED',
            approverId: 'emp-manager',
            actionDate: new Date(),
          },
          {
            stepNo: 2,
            status: 'PENDING',
            approverId: 'emp-hr-older',
            actionDate: null,
          },
        ],
      },
    };
    prisma.leaveRequest.findMany.mockResolvedValue([row]);
    workforceApprovalResolver.isEmployeeScopedLeaveHrActor.mockResolvedValue(
      true,
    );

    const result = await service.getPendingApprovalsForActor(hrActor, 'hr');

    expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          approvalTransaction: { status: 'PENDING' },
        }),
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'lr-1',
      approvalProgress: expect.objectContaining({
        stage: 'HR_REVIEW',
        canAct: true,
      }),
    });
  });
});

describe('Workforce leave error codes used by state machine', () => {
  it('exposes required stable codes', () => {
    expect(WorkforceErrorCode.LEAVE_OVERLAP).toBe('LEAVE_OVERLAP');
    expect(WorkforceErrorCode.LEAVE_STATE_CHANGED).toBe('LEAVE_STATE_CHANGED');
    expect(WorkforceErrorCode.LEAVE_SELF_APPROVAL_FORBIDDEN).toBe(
      'LEAVE_SELF_APPROVAL_FORBIDDEN',
    );
    expect(WorkforceErrorCode.LEAVE_BALANCE_INSUFFICIENT).toBe(
      'LEAVE_BALANCE_INSUFFICIENT',
    );
    expect(WorkforceErrorCode.LEAVE_APPROVER_NOT_AVAILABLE).toBe(
      'LEAVE_APPROVER_NOT_AVAILABLE',
    );
    expect(WorkforceErrorCode.HOLIDAY_MASTER_MOVED).toBe(
      'HOLIDAY_MASTER_MOVED',
    );
    expect(WorkforceErrorCode.OPTIONAL_HOLIDAY_USE_SELECTION).toBe(
      'OPTIONAL_HOLIDAY_USE_SELECTION',
    );
  });
});

describe('LeaveRequestService optional holiday guard', () => {
  const prisma = {
    leaveType: { findFirst: jest.fn() },
    leaveRequest: { findFirst: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  };
  const leavePolicyResolver = { resolveCalculation: jest.fn() };
  const employeeDomainScope = {
    leaveTypeWhere: jest.fn().mockReturnValue({}),
    assertEmployeeInScope: jest.fn().mockResolvedValue({
      id: 'emp-1',
      companyId: 'co-1',
    }),
  };
  const service = new LeaveRequestService(
    prisma as never,
    leavePolicyResolver as never,
    {} as never,
    employeeDomainScope as never,
    {} as never,
    {} as never,
    { log: jest.fn() } as never,
    { write: jest.fn() } as never,
  );

  it('rejects create for OPTIONAL_HOLIDAY leave types', async () => {
    prisma.leaveType.findFirst.mockResolvedValue({
      id: 'lt-oh',
      category: 'OPTIONAL_HOLIDAY',
    });

    await expect(
      service.create({
        employeeId: 'emp-1',
        leaveTypeId: 'lt-oh',
        fromDate: '2027-02-01',
        toDate: '2027-02-01',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: WorkforceErrorCode.OPTIONAL_HOLIDAY_USE_SELECTION,
      }),
    });
    expect(prisma.leaveRequest.create).not.toHaveBeenCalled();
  });
});
