import { AttendanceExceptionType } from '@prisma/client';

import { AttendanceStatus } from './constants';
import { AttendanceFinalizerService } from './attendance-finalizer.service';

/* Nested Jest asymmetric matchers are typed as any. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

describe('AttendanceFinalizerService', () => {
  const prisma = {
    attendance: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    leaveRequest: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const attendancePolicyResolver = {
    resolve: jest.fn().mockResolvedValue({
      finalizationDelayMinutes: 0,
    }),
  };
  const attendanceExceptionService = {
    upsertOpen: jest.fn().mockResolvedValue({ id: 'ex-1', created: true }),
  };

  const service = new AttendanceFinalizerService(
    prisma as never,
    attendancePolicyResolver as never,
    attendanceExceptionService as never,
  );

  const baseAttendance = {
    id: 'att-1',
    employeeId: 'emp-a',
    attendanceDate: new Date('2027-02-01T00:00:00.000Z'),
    scheduledEndAt: new Date('2020-01-01T00:00:00.000Z'),
    checkInTime: null,
    checkOutTime: null,
    status: 'ABSENT',
    classificationReason: null,
    scheduleDayType: 'WORKING',
    shiftRosterEntryId: 'sre-1',
    employee: {
      id: 'emp-a',
      companyId: 'co-1',
      branchId: 'br-1',
      branch: { timezone: 'Asia/Kolkata' },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
    );
    prisma.attendance.updateMany.mockResolvedValue({ count: 1 });
    prisma.leaveRequest.findFirst.mockResolvedValue(null);
  });

  it('finalizes selected employee with no punches as LEAVE without missing-check-in', async () => {
    prisma.attendance.findMany.mockResolvedValue([baseAttendance]);
    prisma.leaveRequest.findFirst.mockResolvedValue({ id: 'lr-oh' });

    const result = await service.finalizeBatch(10);

    expect(result).toEqual({ processed: 1, skipped: 0 });
    expect(prisma.attendance.updateMany).toHaveBeenCalledWith({
      where: { id: 'att-1', finalizedAt: null },
      data: expect.objectContaining({
        status: AttendanceStatus.LEAVE,
        classificationReason: 'FINALIZED_APPROVED_LEAVE',
      }),
    });
    expect(attendanceExceptionService.upsertOpen).not.toHaveBeenCalled();
  });

  it('finalizes non-selected employee with no punches as ABSENT with missing-check-in', async () => {
    prisma.attendance.findMany.mockResolvedValue([
      { ...baseAttendance, id: 'att-b', employeeId: 'emp-b' },
    ]);
    prisma.leaveRequest.findFirst.mockResolvedValue(null);

    const result = await service.finalizeBatch(10);

    expect(result).toEqual({ processed: 1, skipped: 0 });
    expect(prisma.attendance.updateMany).toHaveBeenCalledWith({
      where: { id: 'att-b', finalizedAt: null },
      data: expect.objectContaining({
        status: AttendanceStatus.ABSENT,
        classificationReason: 'FINALIZED_MISSING_CHECK_IN',
      }),
    });
    expect(attendanceExceptionService.upsertOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 'emp-b',
        type: AttendanceExceptionType.MISSING_CHECK_IN,
      }),
      prisma,
    );
  });

  it('keeps PRESENT when employee punched and has no leave lookup needed', async () => {
    prisma.attendance.findMany.mockResolvedValue([
      {
        ...baseAttendance,
        id: 'att-c',
        employeeId: 'emp-c',
        checkInTime: new Date('2027-02-01T03:30:00.000Z'),
        checkOutTime: new Date('2027-02-01T12:30:00.000Z'),
        status: AttendanceStatus.PRESENT,
        classificationReason: 'PRESENT_100',
      },
    ]);

    const result = await service.finalizeBatch(10);

    expect(result).toEqual({ processed: 1, skipped: 0 });
    expect(prisma.leaveRequest.findFirst).not.toHaveBeenCalled();
    expect(prisma.attendance.updateMany).toHaveBeenCalledWith({
      where: { id: 'att-c', finalizedAt: null },
      data: expect.objectContaining({
        status: AttendanceStatus.PRESENT,
      }),
    });
    expect(attendanceExceptionService.upsertOpen).not.toHaveBeenCalled();
  });

  it('does not treat working day as LEAVE when no LeaveRequest exists', async () => {
    prisma.attendance.findMany.mockResolvedValue([baseAttendance]);
    prisma.leaveRequest.findFirst.mockResolvedValue(null);

    await service.finalizeBatch(10);

    expect(prisma.attendance.updateMany).toHaveBeenCalledWith({
      where: { id: 'att-1', finalizedAt: null },
      data: expect.objectContaining({
        status: AttendanceStatus.ABSENT,
      }),
    });
  });
});
