import { BadRequestException, ConflictException } from '@nestjs/common';
import { LeaveTypeCategory, Prisma } from '@prisma/client';

import { WorkforceErrorCode } from '../../common/constants';
import { LeaveRequestStatus } from '../employee-leave/constants';
import type { OptionalHolidayCatalog } from '../business-calendar/optional-holiday-catalog.service';
import { OptionalHolidaySelectionService } from './optional-holiday-selection.service';

/* Nested Jest mocks are typed loosely. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */

function catalogFixture(
  overrides?: Partial<OptionalHolidayCatalog>,
): OptionalHolidayCatalog {
  const holidays = [
    {
      eventId: 'ev-1',
      date: '2027-02-01',
      name: 'Opt 1',
      calendarScope: 'COMPANY' as const,
      selected: false,
      selectionStatus: 'NONE' as const,
      locked: false,
      editableUntil: '2027-01-31T23:59:59',
    },
    {
      eventId: 'ev-2',
      date: '2027-02-02',
      name: 'Opt 2',
      calendarScope: 'COMPANY' as const,
      selected: false,
      selectionStatus: 'NONE' as const,
      locked: false,
      editableUntil: '2027-02-01T23:59:59',
    },
    {
      eventId: 'ev-3',
      date: '2027-02-03',
      name: 'Opt 3',
      calendarScope: 'COMPANY' as const,
      selected: false,
      selectionStatus: 'NONE' as const,
      locked: false,
      editableUntil: '2027-02-02T23:59:59',
    },
    {
      eventId: 'ev-4',
      date: '2027-02-04',
      name: 'Opt 4',
      calendarScope: 'COMPANY' as const,
      selected: false,
      selectionStatus: 'NONE' as const,
      locked: false,
      editableUntil: '2027-02-03T23:59:59',
    },
    {
      eventId: 'ev-5',
      date: '2027-02-05',
      name: 'Opt 5',
      calendarScope: 'COMPANY' as const,
      selected: false,
      selectionStatus: 'NONE' as const,
      locked: false,
      editableUntil: '2027-02-04T23:59:59',
    },
    {
      eventId: 'ev-6',
      date: '2027-02-08',
      name: 'Opt 6',
      calendarScope: 'COMPANY' as const,
      selected: false,
      selectionStatus: 'NONE' as const,
      locked: false,
      editableUntil: '2027-02-07T23:59:59',
    },
  ];

  return {
    year: 2027,
    timezone: 'Asia/Kolkata',
    maximumHolidayDays: 10,
    mandatoryWorkingDayCount: 5,
    optionalAllowance: 5,
    selectedCount: 0,
    remainingCount: 5,
    holidays,
    ...overrides,
  };
}

describe('OptionalHolidaySelectionService', () => {
  const prisma = {
    employee: { findUnique: jest.fn() },
    leaveRequest: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    companyHolidayPolicy: { findFirst: jest.fn() },
    approvalTransaction: {
      create: jest.fn(),
      update: jest.fn(),
    },
    approvalTransactionStep: { create: jest.fn() },
    user: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const catalogService = {
    getCatalog: jest.fn(),
  };
  const auditService = {
    log: jest.fn(),
  };
  const outboxWriter = {
    write: jest.fn().mockResolvedValue({ id: 'ob-1', created: true }),
  };
  const workforceApprovalResolver = {
    resolveWorkflow: jest.fn(),
    resolveLeaveApprovalSteps: jest.fn(),
  };

  const service = new OptionalHolidaySelectionService(
    prisma as never,
    catalogService as never,
    auditService as never,
    outboxWriter as never,
    workforceApprovalResolver as never,
  );

  const actor = { id: 'user-1', employeeId: 'emp-1' };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.employee.findUnique.mockResolvedValue({
      id: 'emp-1',
      isActive: true,
      companyId: 'co-1',
      branchId: 'br-1',
      managerId: 'mgr-1',
      company: { id: 'co-1', companyGroupId: 'cg-1' },
    });
    prisma.companyHolidayPolicy.findFirst.mockResolvedValue({
      optionalHolidayLeaveTypeId: 'lt-oh',
      optionalHolidayLeaveType: {
        id: 'lt-oh',
        category: LeaveTypeCategory.OPTIONAL_HOLIDAY,
        isActive: true,
        requiresApproval: false,
      },
    });
    prisma.leaveRequest.findFirst.mockResolvedValue(null);
    prisma.leaveRequest.findMany.mockResolvedValue([]);
    prisma.leaveRequest.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: `lr-${data.optionalHolidayEventId}`,
        ...data,
      }),
    );
    prisma.leaveRequest.update.mockResolvedValue({});
    prisma.approvalTransaction.create.mockResolvedValue({ id: 'tx-1' });
    prisma.approvalTransactionStep.create.mockResolvedValue({});
    prisma.approvalTransaction.update.mockResolvedValue({});
    prisma.user.findMany.mockResolvedValue([{ id: 'approver-user' }]);
    workforceApprovalResolver.resolveWorkflow.mockResolvedValue({
      id: 'wf-1',
      steps: [],
    });
    workforceApprovalResolver.resolveLeaveApprovalSteps.mockResolvedValue({
      currentStep: 1,
      steps: [
        {
          stepNo: 1,
          name: 'REPORTING_MANAGER',
          label: 'Manager',
          approverId: 'mgr-1',
          status: 'PENDING',
        },
        {
          stepNo: 2,
          name: 'HR',
          label: 'HR',
          approverId: 'hr-1',
          status: 'PENDING',
        },
      ],
    });
    auditService.log.mockResolvedValue(undefined);
    catalogService.getCatalog.mockResolvedValue(catalogFixture());

    prisma.$transaction.mockImplementation(
      async (cb: (tx: typeof prisma) => Promise<unknown>, _options?: unknown) =>
        cb(prisma),
    );
  });

  it('creates five APPROVED leave rows for five valid event IDs when auto-approve', async () => {
    const eventIds = ['ev-1', 'ev-2', 'ev-3', 'ev-4', 'ev-5'];
    catalogService.getCatalog
      .mockResolvedValueOnce(catalogFixture())
      .mockResolvedValueOnce(
        catalogFixture({
          selectedCount: 5,
          remainingCount: 0,
          holidays: catalogFixture().holidays.map((h) =>
            eventIds.includes(h.eventId)
              ? { ...h, selected: true, selectionStatus: 'APPROVED' }
              : h,
          ),
        }),
      );

    const result = await service.updateSelections(
      actor as never,
      2027,
      eventIds,
    );

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
    expect(prisma.leaveRequest.create).toHaveBeenCalledTimes(5);
    expect(prisma.leaveRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        optionalHolidayEventId: 'ev-1',
        requestedDays: 1,
        approvedDays: 1,
        status: LeaveRequestStatus.APPROVED,
        approvedByUserId: null,
        approvalTransactionId: null,
        submittedAt: expect.any(Date) as Date,
        approvedAt: expect.any(Date) as Date,
      }) as object,
    });
    expect(prisma.approvalTransaction.create).not.toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      'LeaveRequest',
      expect.any(String),
      'OPTIONAL_HOLIDAY_AUTO_APPROVED',
      null,
      expect.objectContaining({ approvalTransactionId: null }) as object,
      expect.objectContaining({ userId: 'user-1' }) as object,
    );
    expect(outboxWriter.write).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        eventType: 'OPTIONAL_HOLIDAY_SELECTION_UPDATED',
        dedupeKey:
          'OPTIONAL_HOLIDAY_SELECTION_UPDATED:emp-1:2027:ev-1,ev-2,ev-3,ev-4,ev-5',
        payload: expect.objectContaining({
          recipientUserIds: ['user-1'],
          requiresApproval: false,
        }),
      }),
    );
    expect(result.selectedCount).toBe(5);
  });

  it('creates SUBMITTED leave with approval when requiresApproval is true', async () => {
    prisma.companyHolidayPolicy.findFirst.mockResolvedValue({
      optionalHolidayLeaveTypeId: 'lt-oh',
      optionalHolidayLeaveType: {
        id: 'lt-oh',
        category: LeaveTypeCategory.OPTIONAL_HOLIDAY,
        isActive: true,
        requiresApproval: true,
      },
    });
    catalogService.getCatalog
      .mockResolvedValueOnce(catalogFixture())
      .mockResolvedValueOnce(
        catalogFixture({
          selectedCount: 1,
          remainingCount: 4,
          holidays: catalogFixture().holidays.map((h) =>
            h.eventId === 'ev-1'
              ? { ...h, selected: true, selectionStatus: 'SUBMITTED' }
              : h,
          ),
        }),
      );

    await service.updateSelections(actor as never, 2027, ['ev-1']);

    expect(prisma.leaveRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        optionalHolidayEventId: 'ev-1',
        status: LeaveRequestStatus.SUBMITTED,
        approvedDays: null,
        approvedAt: null,
      }) as object,
    });
    expect(prisma.approvalTransaction.create).toHaveBeenCalledTimes(1);
    expect(prisma.approvalTransactionStep.create).toHaveBeenCalledTimes(2);
    expect(prisma.leaveRequest.update).toHaveBeenCalledWith({
      where: { id: 'lr-ev-1' },
      data: { approvalTransactionId: 'tx-1' },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      'LeaveRequest',
      'lr-ev-1',
      'OPTIONAL_HOLIDAY_SUBMITTED',
      null,
      expect.objectContaining({
        status: LeaveRequestStatus.SUBMITTED,
        approvalTransactionId: 'tx-1',
      }) as object,
      expect.objectContaining({ userId: 'user-1' }) as object,
    );
    expect(outboxWriter.write).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        eventType: 'LEAVE_REQUEST_SUBMITTED',
      }),
    );
  });

  it('is a no-op when the desired set already matches', async () => {
    const eventIds = ['ev-1', 'ev-2'];
    prisma.leaveRequest.findMany.mockResolvedValue(
      eventIds.map((id) => ({
        id: `lr-${id}`,
        optionalHolidayEventId: id,
        status: LeaveRequestStatus.APPROVED,
        approvalTransactionId: null,
      })),
    );
    catalogService.getCatalog.mockResolvedValue(
      catalogFixture({
        selectedCount: 2,
        remainingCount: 3,
        holidays: catalogFixture().holidays.map((h) =>
          eventIds.includes(h.eventId)
            ? { ...h, selected: true, selectionStatus: 'APPROVED' }
            : h,
        ),
      }),
    );

    await service.updateSelections(actor as never, 2027, eventIds);

    expect(prisma.leaveRequest.create).not.toHaveBeenCalled();
    expect(prisma.leaveRequest.update).not.toHaveBeenCalled();
    expect(outboxWriter.write).not.toHaveBeenCalled();
  });

  it('cancels removed future picks immediately and creates additions (option A)', async () => {
    prisma.leaveRequest.findMany.mockResolvedValue([
      {
        id: 'lr-ev-1',
        optionalHolidayEventId: 'ev-1',
        status: LeaveRequestStatus.APPROVED,
        approvalTransactionId: null,
      },
    ]);
    catalogService.getCatalog
      .mockResolvedValueOnce(catalogFixture())
      .mockResolvedValueOnce(catalogFixture({ selectedCount: 1 }));

    await service.updateSelections(actor as never, 2027, ['ev-2']);

    expect(prisma.leaveRequest.update).toHaveBeenCalledWith({
      where: { id: 'lr-ev-1' },
      data: expect.objectContaining({
        status: LeaveRequestStatus.CANCELLED,
        isActive: false,
        cancelledByUserId: 'user-1',
      }) as object,
    });
    expect(prisma.leaveRequest.create).toHaveBeenCalledTimes(1);
    expect(prisma.leaveRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        optionalHolidayEventId: 'ev-2',
        status: LeaveRequestStatus.APPROVED,
      }) as object,
    });
    expect(auditService.log).toHaveBeenCalledWith(
      'LeaveRequest',
      'lr-ev-1',
      'OPTIONAL_HOLIDAY_SELECTION_REMOVED',
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ userId: 'user-1' }) as object,
    );
  });

  it('cancels approval transaction when removing a pending pick', async () => {
    prisma.companyHolidayPolicy.findFirst.mockResolvedValue({
      optionalHolidayLeaveTypeId: 'lt-oh',
      optionalHolidayLeaveType: {
        id: 'lt-oh',
        category: LeaveTypeCategory.OPTIONAL_HOLIDAY,
        isActive: true,
        requiresApproval: true,
      },
    });
    prisma.leaveRequest.findMany.mockResolvedValue([
      {
        id: 'lr-ev-1',
        optionalHolidayEventId: 'ev-1',
        status: LeaveRequestStatus.SUBMITTED,
        approvalTransactionId: 'tx-old',
      },
    ]);
    catalogService.getCatalog
      .mockResolvedValueOnce(catalogFixture())
      .mockResolvedValueOnce(catalogFixture());

    await service.updateSelections(actor as never, 2027, []);

    expect(prisma.approvalTransaction.update).toHaveBeenCalledWith({
      where: { id: 'tx-old' },
      data: { status: 'CANCELLED' },
    });
  });

  it('cancels removals before overlap checks so same-day swaps succeed', async () => {
    prisma.leaveRequest.findMany.mockResolvedValue([
      {
        id: 'lr-ev-1',
        optionalHolidayEventId: 'ev-1',
        status: LeaveRequestStatus.APPROVED,
        approvalTransactionId: null,
      },
    ]);
    // Same calendar date as ev-1 in fixture would not apply; simulate overlap
    // by having findFirst return a hit only until after cancel (first call).
    let overlapCalls = 0;
    prisma.leaveRequest.findFirst.mockImplementation(() => {
      overlapCalls += 1;
      // After cancel, no overlap.
      return Promise.resolve(null);
    });
    catalogService.getCatalog
      .mockResolvedValueOnce(catalogFixture())
      .mockResolvedValueOnce(catalogFixture({ selectedCount: 1 }));

    const updateOrder: string[] = [];
    prisma.leaveRequest.update.mockImplementation((args: { where: { id: string } }) => {
      updateOrder.push(`update:${args.where.id}`);
      return Promise.resolve({});
    });
    prisma.leaveRequest.create.mockImplementation(
      (args: { data: { optionalHolidayEventId: string } }) => {
        updateOrder.push(`create:${args.data.optionalHolidayEventId}`);
        return Promise.resolve({
          id: `lr-${args.data.optionalHolidayEventId}`,
          ...args.data,
        });
      },
    );

    await service.updateSelections(actor as never, 2027, ['ev-2']);

    expect(updateOrder[0]).toBe('update:lr-ev-1');
    expect(updateOrder).toContain('create:ev-2');
    expect(overlapCalls).toBeGreaterThanOrEqual(1);
  });

  it('cancels orphan picks whose calendar events are no longer in the catalog', async () => {
    prisma.leaveRequest.findMany.mockResolvedValue([
      {
        id: 'lr-orphan',
        optionalHolidayEventId: 'ev-gone',
        status: LeaveRequestStatus.APPROVED,
        approvalTransactionId: null,
      },
    ]);
    catalogService.getCatalog
      .mockResolvedValueOnce(catalogFixture())
      .mockResolvedValueOnce(catalogFixture({ selectedCount: 1 }));

    await service.updateSelections(actor as never, 2027, ['ev-1']);

    expect(prisma.leaveRequest.update).toHaveBeenCalledWith({
      where: { id: 'lr-orphan' },
      data: expect.objectContaining({
        status: LeaveRequestStatus.CANCELLED,
        isActive: false,
      }) as object,
    });
    expect(prisma.leaveRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        optionalHolidayEventId: 'ev-1',
      }) as object,
    });
  });

  it('rejects adding or removing a locked date for the whole update', async () => {
    const holidays = catalogFixture().holidays.map((h) =>
      h.eventId === 'ev-1'
        ? { ...h, locked: true, selected: true, selectionStatus: 'APPROVED' as const }
        : h,
    );
    catalogService.getCatalog.mockResolvedValue(
      catalogFixture({ holidays, selectedCount: 1, remainingCount: 4 }),
    );
    prisma.leaveRequest.findMany.mockResolvedValue([
      {
        id: 'lr-ev-1',
        optionalHolidayEventId: 'ev-1',
        status: LeaveRequestStatus.APPROVED,
        approvalTransactionId: null,
      },
    ]);

    await expect(
      service.updateSelections(actor as never, 2027, ['ev-2']),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.leaveRequest.create).not.toHaveBeenCalled();
    expect(prisma.leaveRequest.update).not.toHaveBeenCalled();
  });

  it('rejects six desired dates when allowance is five', async () => {
    await expect(
      service.updateSelections(actor as never, 2027, [
        'ev-1',
        'ev-2',
        'ev-3',
        'ev-4',
        'ev-5',
        'ev-6',
      ]),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: WorkforceErrorCode.OPTIONAL_HOLIDAY_ALLOWANCE_EXCEEDED,
      }) as unknown,
    });
  });

  it('rejects non-catalog event IDs', async () => {
    await expect(
      service.updateSelections(actor as never, 2027, ['ev-unknown']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects overlapping leave on add', async () => {
    prisma.leaveRequest.findFirst.mockResolvedValue({ id: 'lr-other' });

    await expect(
      service.updateSelections(actor as never, 2027, ['ev-1']),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
