import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { WorkforceErrorCode } from '../../common/constants';

import { AttendanceService } from './attendance.service';

describe('AttendanceService', () => {
  type MockRecord = Record<string, unknown>;
  type TransactionCallback = (transaction: unknown) => Promise<unknown>;
  type AttendanceFindManyArgs = {
    where: { employee?: { companyId?: string } };
  };
  const asyncMock = <Result, Args extends unknown[] = unknown[]>() =>
    jest.fn<Promise<Result>, Args>();

  const prisma = {
    employee: {
      findFirst: asyncMock<MockRecord | null>(),
    },
    employeeShift: {
      findFirst: asyncMock<MockRecord | null>(),
    },
    attendance: {
      findUnique: asyncMock<MockRecord | null>(),
      findFirst: asyncMock<MockRecord | null>(),
      create: asyncMock<MockRecord>(),
      update: asyncMock<MockRecord>(),
      updateMany: asyncMock<MockRecord>(),
      findMany: asyncMock<MockRecord[], [AttendanceFindManyArgs]>(),
      count: asyncMock<number>().mockResolvedValue(0),
      findUniqueOrThrow: asyncMock<MockRecord>(),
    },
    leaveRequest: {
      findFirst: asyncMock<MockRecord | null>().mockResolvedValue(null),
    },
    attendancePeriod: {
      findUnique: asyncMock<MockRecord | null>().mockResolvedValue(null),
    },
    attendanceRegularization: {
      findMany: asyncMock<MockRecord[]>().mockResolvedValue([]),
      update: asyncMock<MockRecord>(),
    },
    approvalTransaction: {
      update: asyncMock<MockRecord>(),
    },
    $transaction: jest.fn<
      Promise<unknown>,
      [TransactionCallback | Promise<unknown>[]]
    >(),
  };

  const employeeDomainScope = {
    attendanceWhere: jest
      .fn()
      .mockReturnValue({ employee: { companyId: 'co-1' } }),
    employeeWhere: jest.fn().mockReturnValue({ companyId: 'co-1' }),
    notFound: jest.fn((entity = 'Record') => {
      throw new NotFoundException(`${entity} not found`);
    }),
  };

  const auditService = {
    log: jest.fn(),
  };

  const branchTime = {
    requireTimezone: jest.fn((tz: string) => {
      if (!tz) {
        throw new ConflictException({
          code: WorkforceErrorCode.BRANCH_TIMEZONE_REQUIRED,
        });
      }
      return tz;
    }),
    businessDate: jest.fn().mockReturnValue('2026-08-05'),
  };

  const attendancePolicyResolver = {
    resolve: jest.fn().mockResolvedValue({
      lateGraceMinutes: 30,
      earlyDepartureGraceMinutes: 15,
      fullDayThresholdPercent: 90,
      halfDayThresholdPercent: 50,
      maxOpenShiftMinutes: 1440,
      finalizationDelayMinutes: 180,
      regularizationWindowDays: 3,
    }),
  };

  const attendanceExceptionService = {
    findPublishedRosterEntry: jest.fn().mockResolvedValue(null),
    upsertOpen: jest.fn().mockResolvedValue({ id: 'ex-1', created: true }),
    resolveForAttendance: jest.fn(),
  };

  const overtimeRequestService = {
    syncCalculatedFromAttendance: jest.fn().mockResolvedValue(null),
  };

  const calendarConsumer = {
    isActiveOffice: jest.fn().mockResolvedValue(false),
    resolveConsumerDays: jest.fn(),
  };

  const service = new AttendanceService(
    prisma as never,
    employeeDomainScope as never,
    auditService as never,
    branchTime as never,
    attendancePolicyResolver as never,
    attendanceExceptionService as never,
    calendarConsumer as never,
    overtimeRequestService as never,
  );

  const actor = {
    id: 'user-1',
    username: 'emp',
    mustChangePassword: false,
    sessionId: 'sess-1',
    employeeId: 'emp-1',
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
    employeeDomainScope.attendanceWhere.mockReturnValue({
      employee: { companyId: 'co-1' },
    });
    employeeDomainScope.employeeWhere.mockReturnValue({ companyId: 'co-1' });
    branchTime.requireTimezone.mockImplementation((tz: string | null) => {
      if (!tz) {
        throw new BadRequestException({
          code: WorkforceErrorCode.BRANCH_TIMEZONE_REQUIRED,
        });
      }
      return tz;
    });
    branchTime.businessDate.mockReturnValue('2026-08-05');
    attendancePolicyResolver.resolve.mockResolvedValue({
      lateGraceMinutes: 30,
      earlyDepartureGraceMinutes: 15,
      fullDayThresholdPercent: 90,
      halfDayThresholdPercent: 50,
      maxOpenShiftMinutes: 1440,
      finalizationDelayMinutes: 180,
      regularizationWindowDays: 3,
    });
    attendanceExceptionService.findPublishedRosterEntry.mockResolvedValue(null);
    prisma.attendancePeriod.findUnique.mockResolvedValue(null);
    prisma.leaveRequest.findFirst.mockResolvedValue(null);
    prisma.employee.findFirst.mockResolvedValue({
      id: 'emp-1',
      isActive: true,
      companyId: 'co-1',
      branchId: 'br-1',
      branch: { timezone: 'Asia/Kolkata' },
    });
    prisma.$transaction.mockImplementation(
      async (arg: TransactionCallback | Promise<unknown>[]) => {
        if (typeof arg === 'function') {
          return arg(prisma);
        }
        return Promise.all(arg);
      },
    );
  });

  it('rejects duplicate check-in', async () => {
    prisma.employeeShift.findFirst.mockResolvedValue(null);
    prisma.attendance.findUnique.mockResolvedValue({
      id: 'att-1',
      checkInTime: new Date(),
    });
    prisma.attendance.findFirst.mockResolvedValue(null);

    await expect(service.checkIn({}, actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects checkout without check-in', async () => {
    prisma.attendance.findFirst.mockResolvedValue(null);

    try {
      await service.checkOut({}, actor);
      fail('expected conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: WorkforceErrorCode.NOT_CHECKED_IN,
      });
    }
  });

  it('creates check-in and records unscheduled exception when no roster', async () => {
    prisma.employeeShift.findFirst.mockResolvedValue({
      shiftId: 'shift-1',
      shift: {
        startTime: '09:00',
        endTime: '18:00',
        breakMinutes: 60,
        graceInMinutes: 30,
        graceOutMinutes: 15,
        isNightShift: false,
      },
    });
    prisma.attendance.findUnique.mockResolvedValue(null);
    prisma.attendance.findFirst.mockResolvedValue(null);
    prisma.attendance.create.mockResolvedValue({
      id: 'att-1',
      checkInTime: new Date(),
      status: 'PRESENT',
    });

    const result = await service.checkIn({}, actor);
    expect(result.id).toBe('att-1');
    expect(attendanceExceptionService.upsertOpen).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'UNSCHEDULED_WORK' }),
      expect.anything(),
    );
    expect(auditService.log).toHaveBeenCalled();
  });

  it('rejects attendance when branch timezone is missing', async () => {
    prisma.employee.findFirst.mockResolvedValue({
      id: 'emp-1',
      isActive: true,
      companyId: 'co-1',
      branchId: 'br-1',
      branch: { timezone: null },
    });

    await expect(service.checkIn({}, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('scopes findAll through employee domain filter', async () => {
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.attendance.count.mockResolvedValue(0);
    const result = await service.findAll({});
    expect(result).toEqual(
      expect.objectContaining({
        items: [],
        total: 0,
        page: 1,
      }),
    );
    expect(prisma.attendance.findMany.mock.calls[0][0].where.employee).toEqual({
      companyId: 'co-1',
    });
  });

  it('rejects correction when attendance is out of scope', async () => {
    prisma.attendance.findFirst.mockResolvedValue(null);
    await expect(
      service.correct('missing', { correctionReason: 'fix' }, actor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cancels pending regularizations superseded by an HR correction', async () => {
    const attendance = {
      id: 'att-1',
      employeeId: 'emp-1',
      attendanceDate: new Date('2026-08-05T00:00:00.000Z'),
      finalizedAt: null,
      checkInTime: new Date('2026-08-05T09:00:00.000Z'),
      checkOutTime: new Date('2026-08-05T18:00:00.000Z'),
      workedHours: 8,
      lateMinutes: 0,
      earlyDepartureMinutes: 0,
      overtimeMinutes: 0,
      status: 'PRESENT',
      classificationReason: null,
      shiftRosterEntryId: null,
      shiftId: null,
      scheduledStartAt: null,
      scheduledEndAt: null,
      scheduledBreakMinutes: null,
      scheduledNetMinutes: null,
      scheduleTimezone: null,
      scheduleDayType: null,
      schedulePortion: null,
      remarks: null,
      source: 'MANUAL',
      shift: null,
    };
    prisma.attendance.findFirst.mockResolvedValueOnce(attendance);
    prisma.attendance.update.mockResolvedValue({
      ...attendance,
      checkOutTime: new Date('2026-08-05T18:30:00.000Z'),
    });
    prisma.attendanceRegularization.findMany.mockResolvedValue([
      { id: 'regularization-1', approvalTransactionId: 'approval-1' },
    ]);

    await service.correct(
      'att-1',
      {
        checkOutTime: '2026-08-05T18:30:00.000Z',
        correctionReason: 'Corrected missed checkout',
      },
      actor,
    );

    expect(prisma.attendanceRegularization.update).toHaveBeenCalledWith({
      where: { id: 'regularization-1' },
      data: { status: 'CANCELLED' },
    });
    expect(prisma.approvalTransaction.update).toHaveBeenCalledWith({
      where: { id: 'approval-1' },
      data: { status: 'CANCELLED' },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      'AttendanceRegularization',
      'regularization-1',
      'CANCEL',
      expect.anything(),
      expect.objectContaining({
        reason: 'Superseded by attendance correction',
      }),
      expect.anything(),
    );
  });

  it('rejects self-service check-in when approved full-day leave covers today', async () => {
    prisma.leaveRequest.findFirst.mockResolvedValue({ id: 'lr-oh-1' });
    prisma.employeeShift.findFirst.mockResolvedValue(null);
    prisma.attendance.findUnique.mockResolvedValue(null);
    prisma.attendance.findFirst.mockResolvedValue(null);

    try {
      await service.checkIn({}, actor);
      fail('expected conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: WorkforceErrorCode.ATTENDANCE_APPROVED_LEAVE_EXISTS,
      });
    }
    expect(prisma.attendance.create).not.toHaveBeenCalled();
    expect(prisma.attendance.update).not.toHaveBeenCalled();
  });
});
